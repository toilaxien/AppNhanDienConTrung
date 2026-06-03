import os
import sys
import time
import subprocess
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


# File này nằm ở MLOps/scripts/
# Project root = AppNhanDienConTrung/
PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROCESS_SCRIPT = PROJECT_ROOT / "MLOps" / "scripts" / "process_unknown_pool.py"

load_dotenv(PROJECT_ROOT / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError("Missing SUPABASE_URL")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

UNKNOWN_POOL_PREFIX = "unknown_pool/official_batch_001/%"

# Chờ bình thường giữa mỗi lượt chạy
NORMAL_SLEEP_SECONDS = 60

# Nếu gặp quota Gemini thì chờ lâu hơn
QUOTA_SLEEP_SECONDS = 10 * 60

# Giới hạn số vòng để tránh chạy vô hạn nếu có lỗi lặp lại
MAX_ROUNDS = 200


def count_unknown_candidates() -> int:
    result = (
        supabase.table("observations")
        .select("id", count="exact")
        .eq("mlops_status", "unknown_candidate")
        .like("image_path", UNKNOWN_POOL_PREFIX)
        .execute()
    )

    return result.count or 0


def count_auto_labeled() -> int:
    result = (
        supabase.table("observations")
        .select("id", count="exact")
        .eq("mlops_status", "auto_labeled")
        .like("image_path", UNKNOWN_POOL_PREFIX)
        .execute()
    )

    return result.count or 0


def count_approved_for_training() -> int:
    result = (
        supabase.table("observations")
        .select("id", count="exact")
        .eq("mlops_status", "approved_for_training")
        .like("image_path", UNKNOWN_POOL_PREFIX)
        .execute()
    )

    return result.count or 0


def count_rejected() -> int:
    result = (
        supabase.table("observations")
        .select("id", count="exact")
        .eq("mlops_status", "rejected")
        .like("image_path", UNKNOWN_POOL_PREFIX)
        .execute()
    )

    return result.count or 0


def count_need_review() -> int:
    result = (
        supabase.table("observations")
        .select("id", count="exact")
        .eq("mlops_status", "need_review")
        .like("image_path", UNKNOWN_POOL_PREFIX)
        .execute()
    )

    return result.count or 0


def print_status():
    unknown_count = count_unknown_candidates()
    auto_labeled_count = count_auto_labeled()
    approved_count = count_approved_for_training()
    rejected_count = count_rejected()
    need_review_count = count_need_review()

    print("\nCurrent unknown pool status:")
    print(f"- unknown_candidate      : {unknown_count}")
    print(f"- auto_labeled           : {auto_labeled_count}")
    print(f"- approved_for_training  : {approved_count}")
    print(f"- rejected               : {rejected_count}")
    print(f"- need_review            : {need_review_count}")

    return unknown_count


def run_process_script() -> str:
    print("\nRunning process_unknown_pool.py ...")

    completed = subprocess.run(
        [sys.executable, str(PROCESS_SCRIPT)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )

    output = (completed.stdout or "") + "\n" + (completed.stderr or "")

    print(output)

    if completed.returncode != 0:
        print(f"process_unknown_pool.py exited with code {completed.returncode}")

    return output


def main():
    print("Start running unknown pool processor until no unknown_candidate remains.")
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Process script: {PROCESS_SCRIPT}")

    for round_index in range(1, MAX_ROUNDS + 1):
        print("\n" + "=" * 80)
        print(f"ROUND {round_index}/{MAX_ROUNDS}")

        unknown_before = print_status()

        if unknown_before == 0:
            print("\nDONE: No unknown_candidate images left.")
            return

        output = run_process_script()

        unknown_after = print_status()

        if unknown_after == 0:
            print("\nDONE: No unknown_candidate images left.")
            return

        if (
            "QUOTA LIMIT" in output
            or "RESOURCE_EXHAUSTED" in output
            or "quota_retry_later" in output
            or "429" in output
        ):
            print(f"\nGemini quota detected. Sleeping {QUOTA_SLEEP_SECONDS} seconds...")
            time.sleep(QUOTA_SLEEP_SECONDS)
        else:
            print(f"\nSleeping {NORMAL_SLEEP_SECONDS} seconds...")
            time.sleep(NORMAL_SLEEP_SECONDS)

    print("\nSTOPPED: Reached MAX_ROUNDS before finishing.")


if __name__ == "__main__":
    main()