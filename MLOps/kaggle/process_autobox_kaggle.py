import os
import re
import json
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image
from supabase import create_client
from ultralytics import YOLOWorld


# ============================================================
# 1. Load secrets
# ============================================================

def get_secret(name: str) -> str | None:
    """
    Ưu tiên lấy từ biến môi trường.
    Nếu chạy trên Kaggle, thử lấy từ Kaggle Secrets.
    """
    value = os.getenv(name)
    if value:
        return value

    try:
        from kaggle_secrets import UserSecretsClient
        user_secrets = UserSecretsClient()
        return user_secrets.get_secret(name)
    except Exception:
        return None


SUPABASE_URL = get_secret("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = get_secret("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError("Missing SUPABASE_URL")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")


supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ============================================================
# 2. Config
# ============================================================

BUCKET_NAME = "observations"
UNKNOWN_POOL_FOLDER = "unknown_pool"

# Số ảnh xử lý mỗi lần Kaggle chạy.
MAX_IMAGES_PER_RUN = 30

# Demo hiện tại để 2. Khi chạy thật đổi lại 20 hoặc cao hơn.
MIN_IMAGES_PER_CANDIDATE_CLASS = 2

# YOLO-World detector config.
YOLO_WORLD_MODEL = "yolov8s-worldv2.pt"

# Ngưỡng detector.
# Với demo, nên nới nhẹ để tránh outlier quá nhiều.
MIN_DETECTION_CONFIDENCE = 0.15
MIN_BOX_AREA_RATIO = 0.0005
MAX_BOX_AREA_RATIO = 0.95

DETECTOR_MODEL_NAME = "yolov8s-worldv2"
PIPELINE_VERSION = "autobox_yoloworld_v1_debug"


# ============================================================
# 3. Utility
# ============================================================

def slugify_label(label: str) -> str:
    label = label.strip().lower()
    label = re.sub(r"[^a-z0-9]+", "_", label)
    label = re.sub(r"_+", "_", label).strip("_")
    return label or "unknown_insect"


def download_image(image_path: str) -> bytes:
    return supabase.storage.from_(BUCKET_NAME).download(image_path)


def save_image_to_temp(image_bytes: bytes, suffix: str = ".jpg") -> str:
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_file.write(image_bytes)
    temp_file.flush()
    temp_file.close()
    return temp_file.name


def get_image_size(image_bytes: bytes) -> tuple[int, int]:
    with Image.open(BytesIO(image_bytes)) as img:
        return img.size


def bbox_xyxy_to_xywh_json(x1: float, y1: float, x2: float, y2: float) -> dict[str, int]:
    x = int(round(x1))
    y = int(round(y1))
    w = int(round(x2 - x1))
    h = int(round(y2 - y1))

    return {
        "x": x,
        "y": y,
        "width": w,
        "height": h,
    }


def clamp_bbox(bbox: dict[str, int], image_width: int, image_height: int) -> dict[str, int]:
    x = max(0, int(bbox["x"]))
    y = max(0, int(bbox["y"]))
    w = int(bbox["width"])
    h = int(bbox["height"])

    if x >= image_width:
        x = image_width - 1

    if y >= image_height:
        y = image_height - 1

    w = max(1, min(w, image_width - x))
    h = max(1, min(h, image_height - y))

    return {
        "x": x,
        "y": y,
        "width": w,
        "height": h,
    }


def get_bbox_area_ratio(
    bbox: dict[str, Any] | None,
    image_width: int,
    image_height: int,
) -> float | None:
    if not bbox:
        return None

    try:
        w = float(bbox.get("width", 0))
        h = float(bbox.get("height", 0))
        image_area = max(1, image_width * image_height)
        return (w * h) / image_area
    except Exception:
        return None


def get_bbox_debug_info(
    bbox: dict[str, Any] | None,
    image_width: int,
    image_height: int,
    detection_confidence: float,
    suggested_label: str,
    detection_reason: str | None = None,
) -> dict[str, Any]:
    area_ratio = get_bbox_area_ratio(
        bbox=bbox,
        image_width=image_width,
        image_height=image_height,
    )

    debug = {
        "suggested_label": suggested_label,
        "detection_reason": detection_reason,
        "detector_confidence": round(float(detection_confidence or 0.0), 4),
        "image_width": image_width,
        "image_height": image_height,
        "min_detection_confidence": MIN_DETECTION_CONFIDENCE,
        "min_box_area_ratio": MIN_BOX_AREA_RATIO,
        "max_box_area_ratio": MAX_BOX_AREA_RATIO,
        "bbox": bbox,
        "bbox_area_ratio": round(area_ratio, 6) if area_ratio is not None else None,
    }

    if bbox:
        debug["bbox_width"] = bbox.get("width")
        debug["bbox_height"] = bbox.get("height")

    return debug


def print_bbox_debug(title: str, debug: dict[str, Any]) -> None:
    print(f"\n{title}")
    print(json.dumps(debug, ensure_ascii=False, indent=2))


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

    area_ratio = (w * h) / max(1, image_width * image_height)

    if area_ratio < MIN_BOX_AREA_RATIO:
        return False, "bbox_too_small"

    if area_ratio > MAX_BOX_AREA_RATIO:
        return False, "bbox_too_large"

    return True, "bbox_valid"


# ============================================================
# 4. Supabase query
# ============================================================

def get_pending_autobox_rows() -> list[dict[str, Any]]:
    """
    Lấy các ảnh đã qua classification nhưng chưa có bbox.

    Điều kiện:
    - observations.mlops_status = auto_labeled
    - auto_labels.status = suggested
    - auto_labels.bbox_json is null
    """
    obs_result = (
        supabase.table("observations")
        .select("id,image_path,image_width,image_height,mlops_status")
        .eq("mlops_status", "auto_labeled")
        .like("image_path", f"{UNKNOWN_POOL_FOLDER}/%")
        .limit(MAX_IMAGES_PER_RUN)
        .execute()
    )

    observations = obs_result.data or []
    rows = []

    for obs in observations:
        label_result = (
            supabase.table("auto_labels")
            .select(
                "id,observation_id,suggested_label,suggested_label_vi,"
                "scientific_name,confidence,status,bbox_json"
            )
            .eq("observation_id", obs["id"])
            .eq("status", "suggested")
            .is_("bbox_json", "null")
            .limit(1)
            .execute()
        )

        labels = label_result.data or []

        if not labels:
            continue

        label = labels[0]
        suggested_label = str(label.get("suggested_label") or "").strip().lower()

        if suggested_label in {
            "",
            "non_insect",
            "unknown",
            "unknown_insect",
            "uncertain",
        }:
            continue

        rows.append({
            "observation": obs,
            "auto_label": label,
        })

    return rows


def update_auto_label_bbox(
    auto_label_id: str,
    bbox_json: dict[str, int],
    detector_confidence: float,
) -> None:
    supabase.table("auto_labels").update({
        "bbox_json": bbox_json,
        "confidence": detector_confidence,
        "prompt": f"detector_bbox:{PIPELINE_VERSION}",
        "labeling_model": DETECTOR_MODEL_NAME,
        "status": "suggested",
    }).eq("id", auto_label_id).execute()


def mark_outlier(
    observation_id: str,
    auto_label_id: str,
    reason: str,
    debug: dict[str, Any] | None = None,
) -> None:
    """
    Không lưu bbox lỗi vào auto_labels.bbox_json.
    Chỉ lưu debug vào observations.review_note để review.
    """
    debug_text = ""

    if debug:
        debug_text = "|debug=" + json.dumps(debug, ensure_ascii=False)[:1200]

    review_note = f"{reason}{debug_text}"

    print("\nMARK OUTLIER")
    print("reason:", reason)
    if debug:
        print_bbox_debug("OUTLIER DEBUG", debug)

    supabase.table("auto_labels").update({
        "status": "outlier",
    }).eq("id", auto_label_id).execute()

    supabase.table("observations").update({
        "mlops_status": "need_review",
        "review_note": review_note,
    }).eq("id", observation_id).execute()


def mark_bbox_pass_waiting_for_group(
    observation_id: str,
    reason: str = "detector_bbox_passed_waiting_for_grouping",
) -> None:
    supabase.table("observations").update({
        "mlops_status": "auto_labeled",
        "review_note": reason,
    }).eq("id", observation_id).execute()


# ============================================================
# 5. YOLO-World detector
# ============================================================

def load_detector() -> YOLOWorld:
    model = YOLOWorld(YOLO_WORLD_MODEL)
    return model


def detect_bbox_with_yoloworld(
    model: YOLOWorld,
    image_file_path: str,
    suggested_label: str,
) -> tuple[dict[str, int] | None, float, str]:
    """
    Dùng YOLO-World open-vocabulary detection.
    Prompt chính là suggested_label từ Gemini, ví dụ 'cicada'.
    """
    prompts = [
        suggested_label,
        f"{suggested_label} insect",
        f"a photo of a {suggested_label}",
        "insect",
        "bug",
    ]

    print("YOLO-World prompts:", prompts)

    model.set_classes(prompts)

    results = model.predict(
        source=image_file_path,
        conf=MIN_DETECTION_CONFIDENCE,
        verbose=False,
    )

    if not results:
        return None, 0.0, "no_detection_result"

    result = results[0]

    if result.boxes is None or len(result.boxes) == 0:
        return None, 0.0, "no_boxes_detected"

    boxes_xyxy = result.boxes.xyxy.cpu().numpy()
    confs = result.boxes.conf.cpu().numpy()
    classes = result.boxes.cls.cpu().numpy()

    print(f"Detected boxes count: {len(confs)}")

    for idx, conf in enumerate(confs):
        x1, y1, x2, y2 = boxes_xyxy[idx]
        class_idx = int(classes[idx])
        prompt_name = prompts[class_idx] if class_idx < len(prompts) else str(class_idx)

        print(
            f"  box[{idx}] "
            f"prompt={prompt_name}, "
            f"conf={float(conf):.4f}, "
            f"xyxy=({float(x1):.1f},{float(y1):.1f},{float(x2):.1f},{float(y2):.1f})"
        )

    best_idx = int(confs.argmax())
    best_conf = float(confs[best_idx])
    x1, y1, x2, y2 = boxes_xyxy[best_idx]

    bbox = bbox_xyxy_to_xywh_json(x1, y1, x2, y2)

    return bbox, best_conf, "detected"


# ============================================================
# 6. Candidate class grouping / promotion
# ============================================================

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


def ensure_candidate_insect(group: dict[str, Any]) -> str:
    suggested_label = group["suggested_label"]
    suggested_label_vi = group["suggested_label_vi"]
    scientific_name = group["scientific_name"]

    insect_id = slugify_label(suggested_label)

    if insect_exists(insect_id):
        print(f"Candidate insect exists: {insect_id}")
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


def get_groups_ready_for_training() -> list[dict[str, Any]]:
    """
    Gom các auto_labels:
    - status = suggested
    - bbox_json != null
    - observation.mlops_status = auto_labeled

    Không gom bằng tiếng Việt.
    """
    label_result = (
        supabase.table("auto_labels")
        .select(
            "id,observation_id,suggested_label,suggested_label_vi,"
            "scientific_name,confidence,status,bbox_json"
        )
        .eq("status", "suggested")
        .not_.is_("bbox_json", "null")
        .execute()
    )

    labels = label_result.data or []

    groups: dict[str, dict[str, Any]] = {}

    for label in labels:
        suggested_label = str(label.get("suggested_label") or "").strip().lower()

        if suggested_label in {
            "",
            "non_insect",
            "unknown",
            "unknown_insect",
            "uncertain",
        }:
            continue

        obs_result = (
            supabase.table("observations")
            .select("id,image_path,mlops_status")
            .eq("id", label["observation_id"])
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

        group_key = slugify_label(suggested_label)

        if group_key not in groups:
            groups[group_key] = {
                "normalized_label": group_key,
                "suggested_label": suggested_label,
                "suggested_label_vi": label.get("suggested_label_vi"),
                "scientific_name": label.get("scientific_name"),
                "auto_label_ids": [],
                "observation_ids": [],
            }

        groups[group_key]["auto_label_ids"].append(label["id"])
        groups[group_key]["observation_ids"].append(label["observation_id"])

    return list(groups.values())


def promote_groups_if_enough_samples() -> None:
    groups = get_groups_ready_for_training()

    if not groups:
        print("No bbox-ready candidate groups found.")
        return

    print("BBox-ready candidate groups:")

    for group in groups:
        observation_ids = list(set(group["observation_ids"]))
        auto_label_ids = list(set(group["auto_label_ids"]))
        count = len(observation_ids)

        print(f"- {group['suggested_label']}: {count} image(s)")

        if count < MIN_IMAGES_PER_CANDIDATE_CLASS:
            print(
                f"  WAIT: need {MIN_IMAGES_PER_CANDIDATE_CLASS}, current={count}"
            )
            continue

        insect_id = ensure_candidate_insect(group)

        for auto_label_id in auto_label_ids:
            supabase.table("auto_labels").update({
                "status": "accepted",
            }).eq("id", auto_label_id).execute()

        for observation_id in observation_ids:
            supabase.table("observations").update({
                "predicted_insect_id": insect_id,
                "predicted_label": insect_id,
                "mlops_status": "approved_for_training",
                "review_note": (
                    f"detector_bbox_group_promoted:"
                    f"{group['suggested_label']}:count={count}"
                ),
            }).eq("id", observation_id).execute()

        print(
            f"PROMOTED group '{group['suggested_label']}' "
            f"as '{insect_id}' with {count} images."
        )


# ============================================================
# 7. Main
# ============================================================

def process_autobox() -> None:
    rows = get_pending_autobox_rows()

    print(f"Pending AutoBox rows: {len(rows)}")
    print(f"MIN_DETECTION_CONFIDENCE={MIN_DETECTION_CONFIDENCE}")
    print(f"MIN_BOX_AREA_RATIO={MIN_BOX_AREA_RATIO}")
    print(f"MAX_BOX_AREA_RATIO={MAX_BOX_AREA_RATIO}")
    print(f"MIN_IMAGES_PER_CANDIDATE_CLASS={MIN_IMAGES_PER_CANDIDATE_CLASS}")
    print(f"UNKNOWN_POOL_FOLDER={UNKNOWN_POOL_FOLDER}")

    if rows:
        detector = load_detector()

        for row in rows:
            obs = row["observation"]
            label = row["auto_label"]

            observation_id = obs["id"]
            auto_label_id = label["id"]
            image_path = obs["image_path"]
            suggested_label = str(label["suggested_label"]).strip().lower()

            print(f"\nProcessing AutoBox: {image_path}")
            print(f"Suggested label: {suggested_label}")

            try:
                image_bytes = download_image(image_path)
                image_width, image_height = get_image_size(image_bytes)

                print(f"Image size: {image_width}x{image_height}")

                suffix = Path(image_path).suffix or ".jpg"
                temp_image_path = save_image_to_temp(image_bytes, suffix=suffix)

                bbox, detection_confidence, detection_reason = detect_bbox_with_yoloworld(
                    model=detector,
                    image_file_path=temp_image_path,
                    suggested_label=suggested_label,
                )

                print("Detector result:", bbox, detection_confidence, detection_reason)

                if bbox is None:
                    debug = get_bbox_debug_info(
                        bbox=None,
                        image_width=image_width,
                        image_height=image_height,
                        detection_confidence=detection_confidence,
                        suggested_label=suggested_label,
                        detection_reason=detection_reason,
                    )

                    mark_outlier(
                        observation_id=observation_id,
                        auto_label_id=auto_label_id,
                        reason=f"autobox_failed:{detection_reason}",
                        debug=debug,
                    )
                    continue

                bbox = clamp_bbox(bbox, image_width, image_height)

                debug_after_clamp = get_bbox_debug_info(
                    bbox=bbox,
                    image_width=image_width,
                    image_height=image_height,
                    detection_confidence=detection_confidence,
                    suggested_label=suggested_label,
                    detection_reason=detection_reason,
                )

                print_bbox_debug("BBOX AFTER CLAMP", debug_after_clamp)

                if detection_confidence < MIN_DETECTION_CONFIDENCE:
                    mark_outlier(
                        observation_id=observation_id,
                        auto_label_id=auto_label_id,
                        reason=f"detector_low_confidence_{detection_confidence:.3f}",
                        debug=debug_after_clamp,
                    )
                    continue

                bbox_ok, bbox_reason = is_bbox_valid(
                    bbox=bbox,
                    image_width=image_width,
                    image_height=image_height,
                )

                print(f"BBox quality gate: {bbox_ok}, reason={bbox_reason}")

                if not bbox_ok:
                    mark_outlier(
                        observation_id=observation_id,
                        auto_label_id=auto_label_id,
                        reason=bbox_reason,
                        debug=debug_after_clamp,
                    )
                    continue

                print_bbox_debug("BBOX PASSED QUALITY GATE", debug_after_clamp)

                update_auto_label_bbox(
                    auto_label_id=auto_label_id,
                    bbox_json=bbox,
                    detector_confidence=detection_confidence,
                )

                mark_bbox_pass_waiting_for_group(
                    observation_id=observation_id,
                    reason=(
                        "detector_bbox_passed_waiting_for_grouping"
                        f"|debug={json.dumps(debug_after_clamp, ensure_ascii=False)[:1000]}"
                    ),
                )

                print(
                    f"UPDATED bbox: {image_path}, "
                    f"bbox={bbox}, conf={detection_confidence:.3f}"
                )

            except Exception as exc:
                mark_outlier(
                    observation_id=observation_id,
                    auto_label_id=auto_label_id,
                    reason=f"autobox_error:{str(exc)[:180]}",
                    debug={
                        "suggested_label": suggested_label,
                        "image_path": image_path,
                        "error": str(exc)[:300],
                    },
                )
                print(f"ERROR AutoBox {image_path}: {exc}")

    else:
        print("No pending AutoBox rows. Skip bbox generation.")

    print("Checking candidate groups for promotion...")
    promote_groups_if_enough_samples()


def main() -> None:
    process_autobox()


if __name__ == "__main__":
    main()