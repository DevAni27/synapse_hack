from pathlib import Path

import numpy as np
from PIL import Image

from app.services.diameter import (
    analyze_vessel_diameter,
)

from app.services.visualization import (
    save_combined_overlay,
    save_focus_view,
    save_isolated_artery,
)


CLASS_IDS = {
    "LAD": 1,
    "LCX": 2,
    "RCA": 3,
}


def _empty_artery() -> dict:
    return {
        "present": False,
        "mask_filename": None,
        "isolated_filename": None,
        "focus_filename": None,
        "diameter_filename": None,
        "diameter": None,
    }


def build_segmentation_outputs(
    *,
    original: Image.Image,
    class_map: np.ndarray,
    coronary_view: str,
    analysis_dir: Path,
) -> dict:
    """
    Convert FPN multiclass output into the API
    outputs used by Arbor.

    Classes:
        0 = background
        1 = LAD
        2 = LCX
        3 = RCA
    """

    original = original.convert(
        "RGB"
    )

    # The FPN predicts at 512x512.
    # Resize categorical classes back to
    # original image dimensions using nearest
    # neighbor interpolation.
    class_map_image = Image.fromarray(
        class_map.astype(
            np.uint8
        )
    )

    class_map_image = (
        class_map_image.resize(
            original.size,
            Image.Resampling.NEAREST,
        )
    )

    resized_map = np.asarray(
        class_map_image,
        dtype=np.uint8,
    )

    segmentation_filename = (
        "segmentation_classes.png"
    )

    class_map_image.save(
        analysis_dir
        / segmentation_filename
    )

    artery_data = {
        "LAD": _empty_artery(),
        "LCX": _empty_artery(),
        "RCA": _empty_artery(),
    }

    if coronary_view == "LCA":

        expected_arteries = {
            "LAD",
            "LCX",
        }

    elif coronary_view == "RCA":

        expected_arteries = {
            "RCA",
        }

    else:

        raise ValueError(
            "coronary_view must "
            "be LCA or RCA"
        )

    masks: dict[
        str,
        Image.Image,
    ] = {}

    unexpected_classes: list[
        str
    ] = []

    for (
        artery_name,
        class_id,
    ) in CLASS_IDS.items():

        pixels = (
            resized_map
            == class_id
        )

        class_present = bool(
            np.any(
                pixels
            )
        )

        if (
            class_present
            and artery_name
            not in expected_arteries
        ):

            unexpected_classes.append(
                artery_name
            )

            continue

        if (
            not class_present
            or artery_name
            not in expected_arteries
        ):
            continue

        binary_array = np.where(
            pixels,
            255,
            0,
        ).astype(
            np.uint8
        )

        binary_mask = Image.fromarray(
            binary_array
        )

        lower = (
            artery_name.lower()
        )

        mask_filename = (
            f"{lower}_mask.png"
        )

        focus_filename = (
            f"{lower}_focus.png"
        )

        isolated_filename = (
            f"{lower}_isolated.png"
        )

        diameter_filename = (
            f"{lower}_diameter.png"
        )

        binary_mask.save(
            analysis_dir
            / mask_filename
        )

        save_focus_view(
            original=original,

            mask=binary_mask,

            artery_name=(
                artery_name
            ),

            output_path=(
                analysis_dir
                / focus_filename
            ),
        )

        save_isolated_artery(
            original=original,

            mask=binary_mask,

            output_path=(
                analysis_dir
                / isolated_filename
            ),
        )

        diameter = (
            analyze_vessel_diameter(
                original=original,

                mask=binary_mask,

                output_path=(
                    analysis_dir
                    / diameter_filename
                ),
            )
        )

        masks[
            artery_name
        ] = binary_mask

        artery_data[
            artery_name
        ] = {
            "present": True,

            "mask_filename":
                mask_filename,

            "isolated_filename":
                isolated_filename,

            "focus_filename":
                focus_filename,

            "diameter_filename":
                (
                    diameter_filename
                    if diameter
                    is not None
                    else None
                ),

            "diameter":
                diameter,
        }

    overlay_filename = (
        "overlay.png"
    )

    save_combined_overlay(
        original=original,

        masks=masks,

        output_path=(
            analysis_dir
            / overlay_filename
        ),
    )

    missing_expected = [
        artery

        for artery
        in expected_arteries

        if not artery_data[
            artery
        ]["present"]
    ]

    return {
        "arteries":
            artery_data,

        "overlay_filename":
            overlay_filename,

        "segmentation_filename":
            segmentation_filename,

        "unexpected_classes":
            unexpected_classes,

        "missing_expected":
            missing_expected,
    }