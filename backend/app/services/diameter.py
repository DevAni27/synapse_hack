from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def _skeletonize(
    binary: np.ndarray,
) -> np.ndarray:
    """
    Morphological skeletonization using OpenCV.

    Input:
        uint8 binary image containing 0 or 255

    Output:
        uint8 skeleton containing 0 or 255
    """

    image = binary.copy()

    skeleton = np.zeros_like(
        image
    )

    element = cv2.getStructuringElement(
        cv2.MORPH_CROSS,
        (3, 3),
    )

    while True:

        eroded = cv2.erode(
            image,
            element,
        )

        opened = cv2.dilate(
            eroded,
            element,
        )

        residue = cv2.subtract(
            image,
            opened,
        )

        skeleton = cv2.bitwise_or(
            skeleton,
            residue,
        )

        image = eroded

        if cv2.countNonZero(
            image
        ) == 0:
            break

    return skeleton


def analyze_vessel_diameter(
    *,
    original: Image.Image,
    mask: Image.Image,
    output_path: Path,
) -> dict | None:
    """
    Estimate relative vessel diameter from a binary
    segmentation mask.

    IMPORTANT:
    Values are in PIXELS, not millimeters.

    Physical millimeter measurement requires known
    image calibration / pixel spacing.
    """

    mask_np = np.asarray(
        mask.convert("L")
    )

    vessel = (
        mask_np >= 128
    ).astype(
        np.uint8
    )

    # Very tiny segmentation -> measurement
    # would not be meaningful.
    if int(vessel.sum()) < 20:
        return None

    vessel_255 = (
        vessel * 255
    ).astype(
        np.uint8
    )

    # ----------------------------------
    # Distance transform
    #
    # Each vessel pixel receives its
    # distance to the nearest boundary.
    #
    # At the centerline:
    #
    # radius ~= distance
    # diameter ~= 2 * distance
    # ----------------------------------

    distance = cv2.distanceTransform(
        vessel,
        cv2.DIST_L2,
        5,
    )

    # ----------------------------------
    # Vessel centerline
    # ----------------------------------

    skeleton = _skeletonize(
        vessel_255
    )

    skeleton_pixels = (
        skeleton > 0
    )

    diameters = (
        2.0
        * distance[
            skeleton_pixels
        ]
    )

    # Remove very small/noisy skeleton
    # measurements near isolated pixels.
    diameters = diameters[
        diameters >= 2.0
    ]

    if len(
        diameters
    ) < 5:
        return None

    p20 = float(
        np.percentile(
            diameters,
            20,
        )
    )

    median = float(
        np.median(
            diameters
        )
    )

    p95 = float(
        np.percentile(
            diameters,
            95,
        )
    )

    mean = float(
        np.mean(
            diameters
        )
    )

    relative_width_drop = (
        max(
            0.0,
            (
                1.0
                - (
                    p20
                    / median
                )
            )
            * 100.0,
        )
        if median > 0
        else 0.0
    )

    # ==================================
    # DIAMETER VISUALIZATION
    # ==================================

    original_np = np.asarray(
        original.convert("RGB")
    ).copy()

    # Darken background slightly.
    display = (
        original_np.astype(
            np.float32
        )
        * 0.42
    ).astype(
        np.uint8
    )

    # Keep segmented vessel clearly visible.
    display[
        vessel > 0
    ] = (
        original_np[
            vessel > 0
        ].astype(
            np.float32
        )
        * 0.75
        + np.array(
            [
                50,
                160,
                210,
            ],
            dtype=np.float32,
        )
        * 0.25
    ).astype(
        np.uint8
    )

    # ----------------------------------
    # Colour centerline according to
    # local vessel diameter.
    # ----------------------------------

    coordinates = np.argwhere(
        skeleton_pixels
    )

    lower = max(
        p20,
        0.001,
    )

    upper = max(
        p95,
        lower + 0.001,
    )

    for y, x in coordinates:

        diameter = (
            2.0
            * distance[
                y,
                x,
            ]
        )

        normalized = (
            diameter - lower
        ) / (
            upper - lower
        )

        normalized = float(
            np.clip(
                normalized,
                0.0,
                1.0,
            )
        )

        value = int(
            normalized * 255
        )

        # OpenCV heatmap:
        # thinner -> cooler end
        # thicker -> warmer end
        heat_pixel = (
            cv2.applyColorMap(
                np.array(
                    [
                        [
                            value
                        ]
                    ],
                    dtype=np.uint8,
                ),
                cv2.COLORMAP_TURBO,
            )[0, 0]
        )

        # OpenCV gives BGR.
        color = (
            int(
                heat_pixel[2]
            ),
            int(
                heat_pixel[1]
            ),
            int(
                heat_pixel[0]
            ),
        )

        cv2.circle(
            display,
            (
                int(x),
                int(y),
            ),
            2,
            color,
            -1,
        )

    Image.fromarray(
        display
    ).save(
        output_path,
        format="PNG",
    )

    return {
        "unit": "px",

        "mean_px":
            round(
                mean,
                2,
            ),

        "median_px":
            round(
                median,
                2,
            ),

        "p20_px":
            round(
                p20,
                2,
            ),

        "p95_px":
            round(
                p95,
                2,
            ),

        "relative_width_variation_pct":
            round(
                relative_width_drop,
                1,
            ),
    }