import os
import json
from pathlib import Path

from ultralytics import YOLO
from supabase import create_client


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
MODEL_VERSION_ID = os.getenv("MODEL_VERSION_ID")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

if not MODEL_VERSION_ID:
    raise RuntimeError("Missing MODEL_VERSION_ID")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "exports" / "dataset_v001"
DATA_YAML = DATASET_DIR / "data.yaml"

RUN_NAME = "yolo_candidate_v001_praying_mantis"
PROJECT_DIR = BASE_DIR / "runs"

BASE_MODEL = "yolo11n.pt"


def main():
    if not DATA_YAML.exists():
        raise FileNotFoundError(f"Cannot find data.yaml: {DATA_YAML}")

    print(f"Using dataset: {DATA_YAML}")

    model = YOLO(BASE_MODEL)

    results = model.train(
        data=str(DATA_YAML),
        epochs=5,
        imgsz=640,
        batch=1,
        project=str(PROJECT_DIR),
        name=RUN_NAME,
        exist_ok=True,
    )

    run_dir = PROJECT_DIR / RUN_NAME
    weights_path = run_dir / "weights" / "best.pt"
    results_csv = run_dir / "results.csv"

    if not weights_path.exists():
        raise FileNotFoundError(f"Cannot find trained weights: {weights_path}")

    metrics = {
        "training_status": "completed",
        "base_model": BASE_MODEL,
        "epochs": 5,
        "imgsz": 640,
        "batch": 1,
        "dataset": "dataset_v001_praying_mantis",
        "weights_local_path": str(weights_path),
        "results_csv_local_path": str(results_csv) if results_csv.exists() else None,
        "note": "Local pipeline test. Dataset is too small for production-quality model."
    }

    artifact_path = f"models/{RUN_NAME}/best.pt"

    with open(weights_path, "rb") as f:
        supabase.storage.from_("observations").upload(
            artifact_path,
            f,
            {"upsert": "true"},
        )

    supabase.table("model_versions").update({
        "metrics_json": metrics,
        "artifact_path": artifact_path,
        "status": "candidate",
    }).eq("id", MODEL_VERSION_ID).execute()

    print("Training completed.")
    print(f"Weights: {weights_path}")
    print(f"Uploaded artifact: {artifact_path}")
    print("Updated model_versions metrics_json and artifact_path.")


if __name__ == "__main__":
    main()