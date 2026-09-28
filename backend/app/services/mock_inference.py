from hashlib import sha256
from pathlib import Path

from PIL import Image, ImageDraw

from app.services.visualization import (
    save_combined_overlay,
    save_focus_view,
    save_isolated_artery,
)


ARTERIES = (
    "LAD",
    "LCX",
    "RCA",
)


def _save_mask(
    size: tuple[int, int],
    points: list[
        tuple[int, int]
    ],
    output_path: Path,
    width: int,
) -> Image.Image:

    mask = Image.new(
        "L",
        size,
        0,
    )

    draw = ImageDraw.Draw(
        mask
    )

    draw.line(
        points,
        fill=255,
        width=width,
        joint="curve",
    )

    mask.save(
        output_path,
        format="PNG",
    )

    return mask


def _normalized_points(
    size: tuple[int, int],
    coords: list[
        tuple[float, float]
    ],
) -> list[
    tuple[int, int]
]:

    width, height = size

    return [
        (
            int(width * x),
            int(height * y),
        )
        for x, y
        in coords
    ]


def _register_artery_outputs(
    *,
    artery_name: str,
    original: Image.Image,
    mask: Image.Image,
    analysis_dir: Path,
) -> dict:

    lower = artery_name.lower()

    mask_filename = (
        f"{lower}_mask.png"
    )

    isolated_filename = (
        f"{lower}_isolated.png"
    )

    focus_filename = (
        f"{lower}_focus.png"
    )

    save_isolated_artery(
        original=original,
        mask=mask,
        output_path=(
            analysis_dir
            / isolated_filename
        ),
    )

    save_focus_view(
        original=original,
        mask=mask,
        artery_name=artery_name,
        output_path=(
            analysis_dir
            / focus_filename
        ),
    )

    return {
        "present": True,

        "mask_filename":
            mask_filename,

        "isolated_filename":
            isolated_filename,

        "focus_filename":
            focus_filename,
    }


def run_mock_inference(
    image: Image.Image,
    analysis_id: str,
    analysis_dir: Path,
    forced_view: str | None = None,
) -> dict:
    """
    Temporary mock inference.

    This exists only so frontend/backend integration
    can continue before Arbor's trained coronary
    models are connected.

    These are NOT medical predictions.
    """

    digest = sha256(
        analysis_id.encode(
            "utf-8"
        )
    ).digest()

# If the real classifier supplied a view,
# ALWAYS use it for temporary segmentation.
    if forced_view in {
        "LCA",
        "RCA",
    }:
        view = forced_view

    else:
        # Full mock fallback only.
        view = (
            "LCA"
            if digest[0] % 2 == 0
            else "RCA"
        )
        
        print(
    "[Arbor] mock_inference:",
    f"forced_view={forced_view}",
    f"view={view}",
)

    confidence = (
        0.94
        + (
            digest[1]
            / 255.0
        )
        * 0.04
    )

    confidence = round(
        min(
            confidence,
            0.98,
        ),
        4,
    )

    width, height = (
        image.size
    )

    line_width = max(
        3,
        min(
            width,
            height,
        )
        // 80,
    )

    artery_data = {
        artery: {
            "present": False,

            "mask_filename":
                None,

            "isolated_filename":
                None,

            "focus_filename":
                None,
        }
        for artery
        in ARTERIES
    }

    masks: dict[
        str,
        Image.Image,
    ] = {}

    if view == "LCA":

        artery_points = {

            "LAD": [
                (0.48, 0.20),
                (0.50, 0.34),
                (0.52, 0.50),
                (0.54, 0.66),
                (0.56, 0.82),
            ],

            "LCX": [
                (0.48, 0.20),
                (0.42, 0.30),
                (0.34, 0.39),
                (0.26, 0.48),
                (0.18, 0.53),
            ],
        }

    else:

        artery_points = {

            "RCA": [
                (0.35, 0.23),
                (0.44, 0.31),
                (0.54, 0.40),
                (0.62, 0.51),
                (0.68, 0.65),
                (0.70, 0.79),
            ],
        }

    for (
        artery_name,
        coords,
    ) in artery_points.items():

        points = (
            _normalized_points(
                image.size,
                coords,
            )
        )

        mask_filename = (
            f"{artery_name.lower()}"
            "_mask.png"
        )

        mask = _save_mask(
            image.size,
            points,
            analysis_dir
            / mask_filename,
            line_width,
        )

        masks[
            artery_name
        ] = mask

        artery_data[
            artery_name
        ] = (
            _register_artery_outputs(
                artery_name=(
                    artery_name
                ),
                original=image,
                mask=mask,
                analysis_dir=(
                    analysis_dir
                ),
            )
        )

    overlay_filename = (
        "overlay.png"
    )

    save_combined_overlay(
        original=image,
        masks=masks,
        output_path=(
            analysis_dir
            / overlay_filename
        ),
    )

    return {
        "view":
            view,

        "confidence":
            confidence,

        "arteries":
            artery_data,

        "overlay_filename":
            overlay_filename,

        "review_required":
            True,

        "model_version":
            "mock-v2",
    }