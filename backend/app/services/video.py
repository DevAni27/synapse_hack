from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


@dataclass(frozen=True)
class BestFrameResult:
    image: Image.Image
    frame_filename: str
    frame_count: int
    fps: float
    duration_seconds: float
    sampled_frames: int
    selected_frame_index: int
    selected_time_seconds: float


def _frame_quality_score(frame: np.ndarray) -> float:
    """
    Generic image-quality heuristic for the hackathon foundation.
    This is NOT a medical or vessel-detection score.

    It prefers frames with useful contrast and sharpness so the
    downstream image model receives a visually informative frame.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    contrast = float(gray.std())
    sharpness = float(
        cv2.Laplacian(gray, cv2.CV_64F).var()
    )

    # Log dampens very large Laplacian values.
    return contrast + 8.0 * float(np.log1p(sharpness))


def extract_best_frame(
    *,
    video_path: Path,
    output_dir: Path,
    max_sampled_frames: int = 24,
) -> BestFrameResult:
    capture = cv2.VideoCapture(str(video_path))

    if not capture.isOpened():
        raise ValueError(
            "The uploaded video could not be decoded."
        )

    frame_count = int(
        capture.get(cv2.CAP_PROP_FRAME_COUNT)
    )
    fps = float(capture.get(cv2.CAP_PROP_FPS))

    if frame_count <= 0:
        capture.release()
        raise ValueError(
            "The uploaded video contains no readable frames."
        )

    if fps <= 0 or not np.isfinite(fps):
        fps = 30.0

    sample_count = min(
        max_sampled_frames,
        frame_count,
    )

    indices = np.linspace(
        0,
        frame_count - 1,
        num=sample_count,
        dtype=int,
    )
    indices = np.unique(indices)

    best_frame = None
    best_index = -1
    best_score = float("-inf")
    readable_count = 0

    for index in indices:
        capture.set(
            cv2.CAP_PROP_POS_FRAMES,
            int(index),
        )

        success, frame = capture.read()

        if not success or frame is None:
            continue

        readable_count += 1
        score = _frame_quality_score(frame)

        if score > best_score:
            best_score = score
            best_frame = frame.copy()
            best_index = int(index)

    capture.release()

    if best_frame is None:
        raise ValueError(
            "No readable frames could be extracted "
            "from the uploaded video."
        )

    rgb = cv2.cvtColor(
        best_frame,
        cv2.COLOR_BGR2RGB,
    )
    image = Image.fromarray(rgb)

    frame_filename = "selected_frame.png"
    image.save(
        output_dir / frame_filename,
        format="PNG",
    )

    duration = frame_count / fps
    selected_time = best_index / fps

    return BestFrameResult(
        image=image,
        frame_filename=frame_filename,
        frame_count=frame_count,
        fps=round(fps, 3),
        duration_seconds=round(duration, 3),
        sampled_frames=readable_count,
        selected_frame_index=best_index,
        selected_time_seconds=round(
            selected_time,
            3,
        ),
    )
