import os
import json
import zipfile
import hashlib
from pathlib import Path

from supabase import create_client


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

BUCKET_NAME = "observations"
DATASET_VERSION_ID = os.getenv("DATASET_VERSION_ID")

DATASET_NAME = "dataset_v001"
OUTPUT_DIR = Path("exports") / DATASET_NAME

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

if not DATASET_VERSION_ID:
    raise RuntimeError("Missing DATASET_VERSION_ID")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def bbox_to_yolo(bbox, image_width, image_height):
    """
    Input bbox format:
    {
      "x": 110,
      "y": 70,
      "width": 320,
      "height": 260
    }

    Output YOLO normalized:
    x_center y_center width height
    """
    x = float(bbox["x"])
    y = float(bbox["y"])
    w = float(bbox["width"])
    h = float(bbox["height"])

    x_center = (x + w / 2) / image_width
    y_center = (y + h / 2) / image_height
    norm_w = w / image_width
    norm_h = h / image_height

    return x_center, y_center, norm_w, norm_h


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_dirs():
    for subdir in [
        "images/train",
        "labels/train",
    ]:
        (OUTPUT_DIR / subdir).mkdir(parents=True, exist_ok=True)


def get_classes():
    result = (
        supabase.table("insects")
        .select("id,name_en,class_index,status")
        .not_.is_("class_index", "null")
        .order("class_index")
        .execute()
    )

    classes = result.data or []

    if not classes:
        raise RuntimeError("No classes found in insects table")

    return classes


def get_training_rows():
    """
    Lấy dữ liệu approved_for_training + accepted auto label.
    Vì ví dụ hiện tại chỉ export praying_mantis candidate,
    script join logic được xử lý ở Python.
    """
    obs_result = (
        supabase.table("observations")
        .select("id,image_path,image_width,image_height,mlops_status")
        .eq("mlops_status", "approved_for_training")
        .execute()
    )

    observations = obs_result.data or []

    rows = []

    for obs in observations:
        auto_result = (
            supabase.table("auto_labels")
            .select("id,observation_id,suggested_label,bbox_json,status")
            .eq("observation_id", obs["id"])
            .eq("status", "accepted")
            .execute()
        )

        auto_labels = auto_result.data or []

        for auto_label in auto_labels:
            # Với test hiện tại, suggested_label = praying mantis.
            # Map sang insect_id = praying_mantis.
            suggested = auto_label["suggested_label"].strip().lower()

            if suggested == "praying mantis":
                insect_id = "praying_mantis"
            else:
                insect_id = suggested.replace(" ", "_")

            insect_result = (
                supabase.table("insects")
                .select("id,name_en,class_index,status")
                .eq("id", insect_id)
                .in_("status", ["candidate", "official"])
                .execute()
            )

            insects = insect_result.data or []

            if not insects:
                print(f"Skip: cannot map suggested_label={suggested} to insects.id")
                continue

            insect = insects[0]

            if insect["class_index"] is None:
                print(f"Skip: insect {insect['id']} has null class_index")
                continue

            if obs["image_width"] is None or obs["image_height"] is None:
                print(f"Skip: observation {obs['id']} missing image_width/image_height")
                continue

            if not auto_label["bbox_json"]:
                print(f"Skip: observation {obs['id']} missing bbox_json")
                continue

            rows.append({
                "observation": obs,
                "auto_label": auto_label,
                "insect": insect,
            })

    return rows


def download_image(image_path, output_path):
    content = supabase.storage.from_(BUCKET_NAME).download(image_path)
    with open(output_path, "wb") as f:
        f.write(content)


def write_data_yaml(classes):
    names = [None] * len(classes)

    for cls in classes:
        idx = int(cls["class_index"])
        if idx >= len(names):
            names.extend([None] * (idx - len(names) + 1))
        names[idx] = cls["name_en"]

    # Loại None nếu có nhưng vẫn giữ class index đúng theo thứ tự.
    yaml_content = "path: .\n"
    yaml_content += "train: images/train\n"
    yaml_content += "val: images/train\n"
    yaml_content += "test: images/train\n\n"
    yaml_content += "names:\n"

    for idx, name in enumerate(names):
        if name is not None:
            yaml_content += f"  {idx}: {name}\n"

    data_yaml_path = OUTPUT_DIR / "data.yaml"
    data_yaml_path.write_text(yaml_content, encoding="utf-8")

    return data_yaml_path


def write_metadata(rows, classes):
    metadata = {
        "dataset_name": DATASET_NAME,
        "dataset_version_id": DATASET_VERSION_ID,
        "image_count": len(rows),
        "class_count": len(classes),
        "source": {
            "bucket": BUCKET_NAME,
            "mlops_status": "approved_for_training",
            "auto_label_status": "accepted",
        },
        "rows": [
            {
                "observation_id": row["observation"]["id"],
                "image_path": row["observation"]["image_path"],
                "auto_label_id": row["auto_label"]["id"],
                "insect_id": row["insect"]["id"],
                "class_index": row["insect"]["class_index"],
            }
            for row in rows
        ],
    }

    metadata_path = OUTPUT_DIR / "metadata.json"
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return metadata_path


def zip_dataset():
    zip_path = Path("exports") / f"{DATASET_NAME}.zip"

    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in OUTPUT_DIR.rglob("*"):
            if file_path.is_file():
                zf.write(file_path, file_path.relative_to(OUTPUT_DIR.parent))

    return zip_path


def main():
    ensure_dirs()

    classes = get_classes()
    rows = get_training_rows()

    if not rows:
        raise RuntimeError("No approved training rows found")

    print(f"Exporting {len(rows)} images...")

    for idx, row in enumerate(rows, start=1):
        obs = row["observation"]
        auto_label = row["auto_label"]
        insect = row["insect"]

        image_path = obs["image_path"]
        image_ext = Path(image_path).suffix or ".jpg"
        image_filename = f"{idx:06d}_{Path(image_path).stem}{image_ext}"

        output_image_path = OUTPUT_DIR / "images/train" / image_filename
        output_label_path = OUTPUT_DIR / "labels/train" / f"{Path(image_filename).stem}.txt"

        download_image(image_path, output_image_path)

        bbox = auto_label["bbox_json"]
        image_width = int(obs["image_width"])
        image_height = int(obs["image_height"])
        class_index = int(insect["class_index"])

        x_center, y_center, w, h = bbox_to_yolo(bbox, image_width, image_height)

        yolo_line = f"{class_index} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}\n"
        output_label_path.write_text(yolo_line, encoding="utf-8")

        print(f"OK: {image_path} -> {image_filename}")

    data_yaml_path = write_data_yaml(classes)
    metadata_path = write_metadata(rows, classes)
    zip_path = zip_dataset()
    dataset_hash = sha256_file(zip_path)

    print(f"Created: {data_yaml_path}")
    print(f"Created: {metadata_path}")
    print(f"Created: {zip_path}")
    print(f"SHA256: {dataset_hash}")

    # Optional: upload zip back to Supabase Storage bucket observations.
    # Có thể đổi sang bucket datasets nếu sau này bạn tạo riêng.
    dataset_zip_storage_path = f"datasets/{DATASET_NAME}.zip"
    data_yaml_storage_path = f"datasets/{DATASET_NAME}/data.yaml"

    with open(zip_path, "rb") as f:
        supabase.storage.from_(BUCKET_NAME).upload(
            dataset_zip_storage_path,
            f,
            {"upsert": "true"},
        )

    with open(data_yaml_path, "rb") as f:
        supabase.storage.from_(BUCKET_NAME).upload(
            data_yaml_storage_path,
            f,
            {"upsert": "true"},
        )

    supabase.table("dataset_versions").update({
        "image_count": len(rows),
        "class_count": len(classes),
        "yaml_path": data_yaml_storage_path,
        "dataset_zip_path": dataset_zip_storage_path,
        "hash": dataset_hash,
        "status": "exported",
    }).eq("id", DATASET_VERSION_ID).execute()

    print("Updated dataset_versions.status = exported")


if __name__ == "__main__":
    main()