"""
SSE Pipeline Timing Script

Sends a file to the process-document-stream SSE endpoint and records
per-stage timing. Used to compare before/after optimizations.

Usage:
    python tests/time_sse_pipeline.py [path_to_file]

Defaults to the Stucco Contract V1.pdf fixture if no arg given.
"""

import sys
import time
import json
import httpx
from pathlib import Path

BACKEND_URL = "http://localhost:8090"
DEFAULT_FIXTURE = Path(__file__).resolve().parent.parent.parent / "localai-admin-dashboard" / "tests" / "fixtures" / "Stucco Contract V1.pdf"


def run_timing(file_path: Path) -> dict:
    """POST file to SSE endpoint and collect stage timings."""

    if not file_path.exists():
        print(f"ERROR: File not found: {file_path}")
        sys.exit(1)

    print(f"File: {file_path.name} ({file_path.stat().st_size / 1024:.1f} KB)")
    print(f"Endpoint: {BACKEND_URL}/api/enhanced-documents/process-document-stream")
    print("-" * 70)

    stages: list[dict] = []
    t0 = time.monotonic()

    with open(file_path, "rb") as f:
        files = {"file": (file_path.name, f, "application/pdf")}
        params = {
            "quick_scan": "true",
            "min_match_confidence": "0.7",
            "allow_generation": "true",
        }

        with httpx.stream(
            "POST",
            f"{BACKEND_URL}/api/enhanced-documents/process-document-stream",
            files=files,
            params=params,
            timeout=300.0,
        ) as response:
            if response.status_code != 200:
                print(f"ERROR: HTTP {response.status_code}")
                print(response.read().decode())
                sys.exit(1)

            event_type = None
            data_lines: list[str] = []
            keepalive_count = 0

            for line in response.iter_lines():
                if line.startswith(": keepalive"):
                    keepalive_count += 1
                    wall_ms = int((time.monotonic() - t0) * 1000)
                    print(f"  [{wall_ms:>6}ms wall]  ♥ keepalive #{keepalive_count}")
                    continue
                if line.startswith("event: "):
                    event_type = line[7:].strip()
                elif line.startswith("data: "):
                    data_lines.append(line[6:])
                elif line == "":
                    # End of event
                    if event_type and data_lines:
                        raw = "\n".join(data_lines)
                        try:
                            data = json.loads(raw)
                        except json.JSONDecodeError:
                            data = {"raw": raw}

                        wall_ms = int((time.monotonic() - t0) * 1000)
                        server_ms = data.get("elapsed_ms", "?")
                        stage_name = data.get("stage", event_type)
                        message = data.get("message", "")
                        progress = data.get("progress", "")

                        entry = {
                            "event": event_type,
                            "stage": stage_name,
                            "message": message,
                            "progress": progress,
                            "server_elapsed_ms": server_ms,
                            "wall_elapsed_ms": wall_ms,
                        }
                        stages.append(entry)

                        # Print live
                        print(
                            f"  [{wall_ms:>6}ms wall | {str(server_ms):>6}ms server] "
                            f"{progress:>4}% {stage_name:<25} {message}"
                        )

                        if event_type == "complete":
                            # Extract result size info
                            result = data.get("result", {})
                            content_len = len(result.get("content", ""))
                            fields = result.get("extracted_fields")
                            field_count = len(fields) if fields else 0
                            action = result.get("action", "?")
                            print(f"\n  Result: action={action}, content={content_len} chars, fields={field_count}")

                        if event_type == "error":
                            print(f"\n  ERROR: {message}")

                    event_type = None
                    data_lines = []

    total_wall = int((time.monotonic() - t0) * 1000)
    print("-" * 70)
    print(f"Total wall time: {total_wall}ms ({total_wall / 1000:.1f}s)")
    print(f"Keepalive heartbeats received: {keepalive_count}")

    if len(stages) >= 2:
        print("\nPer-stage deltas (wall clock):")
        for i in range(1, len(stages)):
            delta = stages[i]["wall_elapsed_ms"] - stages[i - 1]["wall_elapsed_ms"]
            print(f"  {stages[i-1]['stage']:>25} → {stages[i]['stage']:<25} {delta:>6}ms")

    return {
        "file": file_path.name,
        "stages": stages,
        "total_wall_ms": total_wall,
    }


if __name__ == "__main__":
    fp = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_FIXTURE
    print(f"\n{'='*70}")
    print("SSE Pipeline Timing")
    print(f"{'='*70}\n")
    result = run_timing(fp)
    print(f"\n{'='*70}")
    print(f"Done. Total: {result['total_wall_ms']}ms")
    print(f"{'='*70}\n")
