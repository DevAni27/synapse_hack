import os
from pathlib import Path

from PIL import Image

from app.ml.classifier import (
    predict_coronary_view,
)

from app.ml.model_manager import (
    model_manager,
)

from app.ml.segmenter import (
    predict_segmentation,
)

from app.services.mock_inference import (
    run_mock_inference,
)

from app.services.preprocessing import (
    preprocess_for_classifier,
)

from app.services.real_segmentation import (
    build_segmentation_outputs,
)


def _env_flag(
    name: str,
    default: bool,
) -> bool:

    value = os.getenv(
        name,
        str(default),
    )

    return (
        value.strip().lower()
        in {
            "1",
            "true",
            "yes",
            "on",
        }
    )


USE_REAL_CLASSIFIER = _env_flag(
    "USE_REAL_CLASSIFIER",
    True,
)

USE_REAL_SEGMENTER = _env_flag(
    "USE_REAL_SEGMENTER",
    True,
)


def run_analysis(
    *,
    image: Image.Image,
    analysis_id: str,
    analysis_dir: Path,
) -> dict:
    """
    Arbor production hackathon pipeline:

    REAL ResNet-18:
        LCA / RCA classification

    REAL FPN-ResNet18:
        LAD / LCX / RCA segmentation
    """

    # ----------------------------------
    # Emergency full mock fallback
    # ----------------------------------

    if not USE_REAL_CLASSIFIER:

        print(
            "[Arbor] FULL MOCK MODE"
        )

        return run_mock_inference(
            image=image,
            analysis_id=analysis_id,
            analysis_dir=analysis_dir,
        )

    # ==================================
    # REAL CLASSIFICATION
    # ==================================

    classifier = (
        model_manager
        .get_classifier()
    )

    classifier_tensor = (
        preprocess_for_classifier(
            image,
            model_manager.device,
        )
    )

    classification = (
        predict_coronary_view(
            classifier,
            classifier_tensor,
        )
    )

    predicted_view = (
        classification[
            "label"
        ]
    )

    confidence = float(
        classification[
            "confidence"
        ]
    )

    print(
        "[Arbor] Classification:",
        predicted_view,
        f"{confidence:.4f}",
    )

    # ==================================
    # REAL SEGMENTATION
    # ==================================

    if USE_REAL_SEGMENTER:

        segmenter = (
            model_manager
            .get_segmenter()
        )

        class_map = (
            predict_segmentation(
                segmenter,
                image,
                model_manager.device,
                predicted_view,
            )
        )

        print(
            "[Arbor] FPN classes present:",
            sorted(
                set(
                    class_map
                    .flatten()
                    .tolist()
                )
            ),
        )

        segmentation = (
            build_segmentation_outputs(
                original=image,

                class_map=(
                    class_map
                ),

                coronary_view=(
                    predicted_view
                ),

                analysis_dir=(
                    analysis_dir
                ),
            )
        )

        result = {
            "view":
                predicted_view,

            "confidence":
                round(
                    confidence,
                    4,
                ),

            "arteries":
                segmentation[
                    "arteries"
                ],

            "overlay_filename":
                segmentation[
                    "overlay_filename"
                ],

            "review_required":
                True,

            "model_version":
                (
                    "resnet18-lca-rca"
                    "+fpn-resnet18-seg-v1"
                ),
        }

        print(
            "[Arbor] Unexpected classes:",
            segmentation[
                "unexpected_classes"
            ],
        )

        print(
            "[Arbor] Missing expected:",
            segmentation[
                "missing_expected"
            ],
        )

        return result

    # ==================================
    # EMERGENCY SEGMENTATION FALLBACK
    # ==================================

    print(
        "[Arbor] Using mock segmentation."
    )

    result = run_mock_inference(
        image=image,
        analysis_id=analysis_id,
        analysis_dir=analysis_dir,
        forced_view=predicted_view,
    )

    result["view"] = (
        predicted_view
    )

    result["confidence"] = round(
        confidence,
        4,
    )

    result["model_version"] = (
        "resnet18-lca-rca"
        "+mock-seg-v1"
    )

    result["review_required"] = True

    return result