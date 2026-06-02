import json
import os
import re
import time
from io import BytesIO
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
from supabase import create_client


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not SUPABASE_URL:
    raise RuntimeError("Missing SUPABASE_URL")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY")


supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
gemini_client = genai.Client(api_key=GEMINI_API_KEY)


BUCKET_NAME = "observations"
UNKNOWN_POOL_FOLDER = "unknown_pool/official_batch_001"

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

LABELING_MODEL = "gemini-2.5-flash"
PIPELINE_VERSION = "classification_only_v1"

# Giới hạn để tránh Gemini quota 429.
MAX_IMAGES_PER_RUN = 1
REQUEST_DELAY_SECONDS = 15

# Chỉ dùng cho classification gate, không dùng cho bbox.
MIN_CLASSIFICATION_CONFIDENCE = 0.60


def slugify_label(label: str) -> str:
    label = label.strip().lower()
    label = re.sub(r"[^a-z0-9]+", "_", label)
    label = re.sub(r"_+", "_", label).strip("_")
    return label or "unknown_insect"


def list_image_files_recursive(folder_path: str) -> list[str]:
    """
    Quét đệ quy ảnh trong Supabase Storage.

    Hỗ trợ:
    unknown_pool/official_batch_001/*.jpg
    unknown_pool/official_batch_001/cicada/*.jpg
    unknown_pool/official_batch_001/non_insect/*.jpg
    """
    items = supabase.storage.from_(BUCKET_NAME).list(folder_path)
    image_paths: list[str] = []

    for item in items:
        name = item.get("name")
        if not name:
            continue

        full_path = f"{folder_path}/{name}"
        suffix = Path(name).suffix.lower()

        if suffix in VALID_EXTENSIONS:
            image_paths.append(full_path)
        elif "." not in name:
            image_paths.extend(list_image_files_recursive(full_path))

    return image_paths


def download_image(image_path: str) -> bytes:
    return supabase.storage.from_(BUCKET_NAME).download(image_path)


def get_image_size(image_bytes: bytes) -> tuple[int, int]:
    with Image.open(BytesIO(image_bytes)) as img:
        return img.size


def observation_exists(image_path: str) -> bool:
    result = (
        supabase.table("observations")
        .select("id")
        .eq("image_path", image_path)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def insert_unknown_observation(image_path: str, width: int, height: int) -> None:
    payload = {
        "image_path": image_path,
        "predicted_insect_id": None,
        "predicted_label": "unknown",
        "predicted_confidence": None,
        "bbox_json": None,
        "model_version": "main_model_unknown_pool_v001",
        "inference_status": "completed",
        "mlops_status": "unknown_candidate",
        "image_width": width,
        "image_height": height,
        "review_note": f"auto_registered_from_unknown_pool:{PIPELINE_VERSION}",
    }

    supabase.table("observations").insert(payload).execute()


def register_new_storage_images() -> None:
    print(f"Scanning Storage folder: {UNKNOWN_POOL_FOLDER}")

    image_paths = list_image_files_recursive(UNKNOWN_POOL_FOLDER)
    print(f"Found {len(image_paths)} image(s) in Storage")

    inserted = 0
    skipped = 0

    for image_path in image_paths:
        if observation_exists(image_path):
            skipped += 1
            print(f"SKIP existing observation: {image_path}")
            continue

        image_bytes = download_image(image_path)
        width, height = get_image_size(image_bytes)

        insert_unknown_observation(image_path, width, height)

        inserted += 1
        print(f"INSERTED observation: {image_path} ({width}x{height})")

    print(f"Register done. Inserted={inserted}, skipped={skipped}")


def get_pending_unknown_observations() -> list[dict[str, Any]]:
    result = (
        supabase.table("observations")
        .select("id,image_path,image_width,image_height,mlops_status")
        .eq("mlops_status", "unknown_candidate")
        .like("image_path", f"{UNKNOWN_POOL_FOLDER}/%")
        .limit(MAX_IMAGES_PER_RUN)
        .execute()
    )

    return result.data or []


def auto_label_exists(observation_id: str) -> bool:
    result = (
        supabase.table("auto_labels")
        .select("id")
        .eq("observation_id", observation_id)
        .limit(1)
        .execute()
    )

    return bool(result.data)


def parse_json_response(text: str) -> dict[str, Any]:
    cleaned = text.strip()

    if cleaned.startswith("```json"):
        cleaned = cleaned.removeprefix("```json").removesuffix("```").strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```").removesuffix("```").strip()

    return json.loads(cleaned)


def classify_insect_with_gemini(image_bytes: bytes, image_path: str) -> dict[str, Any]:
    """
    Gemini chỉ dùng để phân loại ảnh có côn trùng gì.
    Không yêu cầu bbox ở bước này.
    Bbox sẽ do detector chuyên dụng như Grounding DINO / OWLv2 sinh ở bước sau.
    """
    prompt = f"""
You are an insect classification assistant for an MLOps pipeline.

Task:
Analyze the image and answer: what insect, if any, appears in this image?

Return JSON only with this schema:
{{
  "contains_insect": true or false,
  "suggested_label": "common English insect name in lowercase, e.g. cicada, beetle, wasp, ant, butterfly, or non_insect",
  "suggested_label_vi": "Vietnamese insect name, e.g. ve sầu, bọ cánh cứng, ong bắp cày, or không phải côn trùng",
  "scientific_name": "scientific name if reasonably known, otherwise null",
  "confidence": number from 0.0 to 1.0,
  "reason": "short explanation"
}}

Rules:
- If the image does not contain a real insect, set contains_insect=false and suggested_label="non_insect".
- If the image contains a person, object, scenery, food, toy, plant/leaf without a visible insect, set contains_insect=false.
- If the image contains an insect, identify the most likely insect group or common name.
- If uncertain but it is likely an insect, set contains_insect=true and suggested_label="unknown_insect".
- Do not return bounding box. Bbox will be generated by a detector in a later step.
- Return JSON only. No markdown.

Image path: {image_path}
"""

    image_part = types.Part.from_bytes(
        data=image_bytes,
        mime_type="image/jpeg",
    )

    response = gemini_client.models.generate_content(
        model=LABELING_MODEL,
        contents=[prompt, image_part],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    return parse_json_response(response.text)


def normalize_classification_result(result: dict[str, Any]) -> dict[str, Any]:
    contains_insect = bool(result.get("contains_insect"))
    suggested_label = str(result.get("suggested_label") or "").strip().lower()

    if not contains_insect:
        suggested_label = "non_insect"

    if not suggested_label:
        suggested_label = "unknown_insect"

    result["suggested_label"] = suggested_label

    if not result.get("suggested_label_vi"):
        if suggested_label == "non_insect":
            result["suggested_label_vi"] = "không phải côn trùng"
        elif suggested_label == "unknown_insect":
            result["suggested_label_vi"] = "côn trùng chưa xác định"
        else:
            result["suggested_label_vi"] = suggested_label

    if suggested_label == "non_insect":
        result["scientific_name"] = None

    return result


def create_auto_label(
    observation: dict[str, Any],
    label_result: dict[str, Any],
    status: str,
) -> None:
    payload = {
        "observation_id": observation["id"],
        "suggested_label": label_result.get("suggested_label"),
        "suggested_label_vi": label_result.get("suggested_label_vi"),
        "scientific_name": label_result.get("scientific_name"),
        "prompt": f"gemini_classification_only:{PIPELINE_VERSION}",
        "bbox_json": None,
        "confidence": label_result.get("confidence"),
        "labeling_model": LABELING_MODEL,
        "status": status,
    }

    supabase.table("auto_labels").insert(payload).execute()


def update_observation_status(
    observation_id: str,
    mlops_status: str,
    review_note: str,
    predicted_label: str | None = None,
    predicted_confidence: float | None = None,
) -> None:
    payload: dict[str, Any] = {
        "mlops_status": mlops_status,
        "review_note": review_note,
    }

    if predicted_label is not None:
        payload["predicted_label"] = predicted_label

    if predicted_confidence is not None:
        payload["predicted_confidence"] = predicted_confidence

    supabase.table("observations").update(payload).eq("id", observation_id).execute()


def decide_classification_status(
    label_result: dict[str, Any],
) -> tuple[str, str, str]:
    """
    Return:
    auto_label_status, observation_mlops_status, review_note
    """
    contains_insect = bool(label_result.get("contains_insect"))
    suggested_label = str(label_result.get("suggested_label") or "").strip().lower()
    confidence = float(label_result.get("confidence") or 0.0)

    if not contains_insect or suggested_label == "non_insect":
        return "rejected", "rejected", "non_insect_or_no_visible_insect"

    if suggested_label in {"unknown", "unknown_insect", "uncertain"}:
        return "suggested", "need_review", "unknown_insect_label"

    if confidence < MIN_CLASSIFICATION_CONFIDENCE:
        return "suggested", "need_review", f"low_classification_confidence_{confidence:.2f}"

    # Có côn trùng và đã có label sơ bộ.
    # Chưa đưa vào training vì chưa có bbox detector.
    return "suggested", "auto_labeled", "waiting_for_detector_bbox"


def process_unknown_candidates() -> None:
    observations = get_pending_unknown_observations()
    print(f"Pending unknown_candidate observations: {len(observations)}")

    for observation in observations:
        image_path = observation["image_path"]

        if auto_label_exists(observation["id"]):
            print(f"SKIP already auto-labeled: {image_path}")
            continue

        print(f"Processing classification: {image_path}")

        try:
            image_bytes = download_image(image_path)

            label_result = classify_insect_with_gemini(image_bytes, image_path)
            label_result = normalize_classification_result(label_result)

            print("Gemini classification result:", label_result)

            auto_label_status, observation_status, reason = decide_classification_status(
                label_result
            )

            create_auto_label(observation, label_result, auto_label_status)

            update_observation_status(
                observation_id=observation["id"],
                mlops_status=observation_status,
                review_note=reason,
                predicted_label=label_result.get("suggested_label"),
                predicted_confidence=float(label_result.get("confidence") or 0.0),
            )

            print(
                f"UPDATED: {image_path} "
                f"auto_label={auto_label_status}, "
                f"observation={observation_status}, "
                f"reason={reason}"
            )

            time.sleep(REQUEST_DELAY_SECONDS)

        except Exception as exc:
            error_text = str(exc)

            if (
                "429" in error_text
                or "RESOURCE_EXHAUSTED" in error_text
                or "quota" in error_text.lower()
            ):
                update_observation_status(
                    observation_id=observation["id"],
                    mlops_status="unknown_candidate",
                    review_note=f"quota_retry_later: {error_text[:180]}",
                )
                print(f"QUOTA LIMIT. Keep for retry later: {image_path}")
                break

            update_observation_status(
                observation_id=observation["id"],
                mlops_status="need_review",
                review_note=f"classification_error: {error_text[:200]}",
            )
            print(f"ERROR processing {image_path}: {exc}")


def print_classification_summary() -> None:
    result = (
        supabase.table("auto_labels")
        .select("suggested_label,status,confidence,observation_id")
        .execute()
    )

    rows = result.data or []
    grouped: dict[tuple[str, str], int] = {}

    for row in rows:
        observation_id = row.get("observation_id")

        obs_result = (
            supabase.table("observations")
            .select("id,image_path")
            .eq("id", observation_id)
            .like("image_path", f"{UNKNOWN_POOL_FOLDER}/%")
            .limit(1)
            .execute()
        )

        if not obs_result.data:
            continue

        key = (
            str(row.get("suggested_label") or "null"),
            str(row.get("status") or "null"),
        )
        grouped[key] = grouped.get(key, 0) + 1

    if not grouped:
        print("No classification groups yet.")
        return

    print("Classification groups:")

    for (label, status), count in sorted(grouped.items(), key=lambda x: x[1], reverse=True):
        print(f"- {label} / {status}: {count}")


def main() -> None:
    register_new_storage_images()
    process_unknown_candidates()
    print_classification_summary()


if __name__ == "__main__":
    main()