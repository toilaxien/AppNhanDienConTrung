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
PIPELINE_VERSION = "open_discovery_v1"

# Giới hạn số ảnh xử lý mỗi lần chạy để tránh Gemini quota 429.
MAX_IMAGES_PER_RUN = 1

# Delay giữa các request Gemini, đơn vị giây.
REQUEST_DELAY_SECONDS = 15

# Quality gate thresholds.
MIN_CONFIDENCE = 0.70
MIN_BOX_AREA_RATIO = 0.01
MAX_BOX_AREA_RATIO = 0.90

# Ngưỡng đủ ảnh cùng một suggested_label để tạo candidate class.
# Khi demo ít ảnh có thể hạ xuống 5 hoặc 10.
# Khi làm nghiêm túc nên để 20-50.
MIN_IMAGES_PER_CANDIDATE_CLASS = 20


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


def auto_label_with_gemini(image_bytes: bytes, image_path: str) -> dict[str, Any]:
    prompt = f"""
You are an insect image labeling assistant for an MLOps pipeline.

Task:
Analyze the image and answer: what insect, if any, appears in this image?

Return JSON only with this schema:
{{
  "contains_insect": true or false,
  "suggested_label": "common English insect name in lowercase, e.g. cicada, beetle, wasp, ant, butterfly, or non_insect",
  "suggested_label_vi": "Vietnamese insect name, e.g. ve sầu, bọ cánh cứng, ong bắp cày, or không phải côn trùng",
  "scientific_name": "scientific name if reasonably known, otherwise null",
  "confidence": number from 0.0 to 1.0,
  "bbox": {{
    "x": integer,
    "y": integer,
    "width": integer,
    "height": integer
  }} or null,
  "reason": "short explanation"
}}

Rules:
- If the image does not contain a real insect, set contains_insect=false, suggested_label="non_insect", bbox=null.
- If the image contains a person, object, scenery, food, toy, plant/leaf without a visible insect, set contains_insect=false.
- If the image contains an insect, identify the most likely insect group or common name.
- If uncertain but it is likely an insect, set contains_insect=true, suggested_label="unknown_insect", scientific_name=null.
- bbox must tightly cover the main insect in pixel coordinates relative to the original image.
- If multiple insects exist, label the most prominent insect.
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


def is_bbox_valid(
    bbox: dict[str, Any] | None,
    image_width: int,
    image_height: int,
) -> tuple[bool, str]:
    if not bbox:
        return False, "missing_bbox"

    required_keys = {"x", "y", "width", "height"}

    if not required_keys.issubset(bbox.keys()):
        return False, "bbox_missing_keys"

    try:
        x = float(bbox["x"])
        y = float(bbox["y"])
        w = float(bbox["width"])
        h = float(bbox["height"])
    except Exception:
        return False, "bbox_invalid_number"

    if w <= 0 or h <= 0:
        return False, "bbox_non_positive_size"

    if x < 0 or y < 0:
        return False, "bbox_negative_position"

    if x + w > image_width or y + h > image_height:
        return False, "bbox_out_of_image_bounds"

    area_ratio = (w * h) / (image_width * image_height)

    if area_ratio < MIN_BOX_AREA_RATIO:
        return False, "bbox_too_small"

    if area_ratio > MAX_BOX_AREA_RATIO:
        return False, "bbox_too_large"

    return True, "bbox_valid"


def normalize_label_result(label_result: dict[str, Any]) -> dict[str, Any]:
    contains_insect = bool(label_result.get("contains_insect"))

    suggested_label = str(label_result.get("suggested_label") or "").strip().lower()

    if not contains_insect:
        suggested_label = "non_insect"

    if not suggested_label:
        suggested_label = "unknown_insect"

    label_result["suggested_label"] = suggested_label

    if not label_result.get("suggested_label_vi"):
        if suggested_label == "non_insect":
            label_result["suggested_label_vi"] = "không phải côn trùng"
        elif suggested_label == "unknown_insect":
            label_result["suggested_label_vi"] = "côn trùng chưa xác định"
        else:
            label_result["suggested_label_vi"] = suggested_label

    return label_result


def run_quality_gate(
    observation: dict[str, Any],
    label_result: dict[str, Any],
) -> tuple[str, str, str]:
    image_width = int(observation["image_width"])
    image_height = int(observation["image_height"])

    contains_insect = bool(label_result.get("contains_insect"))
    suggested_label = str(label_result.get("suggested_label") or "").strip().lower()
    confidence = float(label_result.get("confidence") or 0.0)
    bbox = label_result.get("bbox")

    if not contains_insect or suggested_label == "non_insect":
        return "rejected", "rejected", "non_insect_or_no_visible_insect"

    if suggested_label in {"unknown", "unknown_insect", "uncertain"}:
        return "suggested", "need_review", "unknown_insect_label"

    if confidence < MIN_CONFIDENCE:
        return "suggested", "need_review", f"low_confidence_{confidence:.2f}"

    bbox_ok, bbox_reason = is_bbox_valid(bbox, image_width, image_height)

    if not bbox_ok:
        return "outlier", "need_review", bbox_reason

    # Đạt chất lượng label + bbox, nhưng chưa đưa vào training ngay.
    # Cần đợi bước gom lớp đủ số lượng ảnh.
    return "suggested", "auto_labeled", "quality_gate_passed_waiting_for_grouping"


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
        "prompt": f"open_discovery:{PIPELINE_VERSION}",
        "bbox_json": label_result.get("bbox"),
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


def process_unknown_candidates() -> None:
    observations = get_pending_unknown_observations()
    print(f"Pending unknown_candidate observations: {len(observations)}")

    for observation in observations:
        image_path = observation["image_path"]

        if auto_label_exists(observation["id"]):
            print(f"SKIP already auto-labeled: {image_path}")
            continue

        print(f"Processing: {image_path}")

        try:
            image_bytes = download_image(image_path)

            label_result = auto_label_with_gemini(image_bytes, image_path)
            label_result = normalize_label_result(label_result)

            print("Gemini result:", label_result)

            auto_label_status, observation_status, reason = run_quality_gate(
                observation,
                label_result,
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
                review_note=f"auto_label_error: {error_text[:200]}",
            )
            print(f"ERROR processing {image_path}: {exc}")


def get_next_class_index() -> int:
    result = (
        supabase.table("insects")
        .select("class_index")
        .not_.is_("class_index", "null")
        .execute()
    )

    rows = result.data or []
    indices = [int(row["class_index"]) for row in rows if row["class_index"] is not None]

    if not indices:
        return 0

    return max(indices) + 1


def insect_exists(insect_id: str) -> bool:
    result = (
        supabase.table("insects")
        .select("id")
        .eq("id", insect_id)
        .limit(1)
        .execute()
    )

    return bool(result.data)


def create_candidate_insect_from_group(group: dict[str, Any]) -> str:
    suggested_label = group["suggested_label"]
    suggested_label_vi = group["suggested_label_vi"]
    scientific_name = group["scientific_name"]

    insect_id = slugify_label(suggested_label)

    if insect_exists(insect_id):
        print(f"Candidate insect already exists: {insect_id}")
        return insect_id

    next_class_index = get_next_class_index()

    payload = {
        "id": insect_id,
        "name_vi": suggested_label_vi or suggested_label,
        "name_en": suggested_label.title(),
        "scientific_name": scientific_name or "Unknown",
        "description": f"Candidate class discovered automatically from unknown pool: {suggested_label}.",
        "habitat": "Chưa xác định. Cần kiểm duyệt và bổ sung thông tin sau.",
        "habitat_icon": "unknown",
        "role": "Chưa xác định. Cần kiểm duyệt và bổ sung thông tin sau.",
        "role_icon": "unknown",
        "category_color": "#8D6E63",
        "image_cartoon": "",
        "lifecycle_steps": [],
        "class_index": next_class_index,
        "status": "candidate",
        "source": "mlops_candidate",
    }

    supabase.table("insects").insert(payload).execute()

    print(f"CREATED candidate insect: {insect_id}, class_index={next_class_index}")

    return insect_id


def get_grouped_auto_labels() -> list[dict[str, Any]]:
    result = (
        supabase.table("auto_labels")
        .select(
            "id,observation_id,suggested_label,suggested_label_vi,"
            "scientific_name,confidence,status,bbox_json"
        )
        .eq("status", "suggested")
        .gte("confidence", MIN_CONFIDENCE)
        .execute()
    )

    auto_labels = result.data or []

    groups: dict[str, dict[str, Any]] = {}

    for label in auto_labels:
        suggested_label = str(label.get("suggested_label") or "").strip().lower()

        if suggested_label in {
            "",
            "non_insect",
            "unknown_insect",
            "unknown",
            "uncertain",
        }:
            continue

        observation_id = label["observation_id"]

        obs_result = (
            supabase.table("observations")
            .select("id,image_path,mlops_status")
            .eq("id", observation_id)
            .like("image_path", f"{UNKNOWN_POOL_FOLDER}/%")
            .limit(1)
            .execute()
        )

        obs_rows = obs_result.data or []

        if not obs_rows:
            continue

        obs = obs_rows[0]

        if obs["mlops_status"] != "auto_labeled":
            continue

        key = slugify_label(suggested_label)

        if key not in groups:
            groups[key] = {
                "normalized_label": key,
                "suggested_label": suggested_label,
                "suggested_label_vi": label.get("suggested_label_vi"),
                "scientific_name": label.get("scientific_name"),
                "auto_label_ids": [],
                "observation_ids": [],
            }

        groups[key]["auto_label_ids"].append(label["id"])
        groups[key]["observation_ids"].append(observation_id)

    return list(groups.values())


def promote_groups_if_enough_samples() -> None:
    groups = get_grouped_auto_labels()

    if not groups:
        print("No candidate groups found.")
        return

    print("Candidate groups:")

    for group in groups:
        count = len(set(group["observation_ids"]))

        print(f"- {group['suggested_label']}: {count} image(s)")

        if count < MIN_IMAGES_PER_CANDIDATE_CLASS:
            print(
                f"  WAIT: need {MIN_IMAGES_PER_CANDIDATE_CLASS}, "
                f"current={count}"
            )
            continue

        insect_id = create_candidate_insect_from_group(group)

        unique_observation_ids = list(set(group["observation_ids"]))
        unique_auto_label_ids = list(set(group["auto_label_ids"]))

        for auto_label_id in unique_auto_label_ids:
            supabase.table("auto_labels").update({
                "status": "accepted",
            }).eq("id", auto_label_id).execute()

        for observation_id in unique_observation_ids:
            supabase.table("observations").update({
                "predicted_insect_id": insect_id,
                "mlops_status": "approved_for_training",
                "review_note": (
                    f"candidate_group_promoted:"
                    f"{group['suggested_label']}:count={count}"
                ),
            }).eq("id", observation_id).execute()

        print(
            f"PROMOTED group '{group['suggested_label']}' "
            f"as candidate insect '{insect_id}' with {count} images."
        )


def main() -> None:
    register_new_storage_images()
    process_unknown_candidates()
    promote_groups_if_enough_samples()


if __name__ == "__main__":
    main()