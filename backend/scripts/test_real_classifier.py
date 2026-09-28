import argparse

from PIL import Image

from app.ml.classifier import (
    predict_coronary_view,
)

from app.ml.model_manager import (
    model_manager,
)

from app.services.preprocessing import (
    preprocess_for_classifier,
)


def main() -> None:

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "image",
        help=(
            "Path to a coronary "
            "angiography image."
        ),
    )

    args = parser.parse_args()

    print()
    print(
        "=== Arbor Real Classifier ==="
    )
    print()

    image = Image.open(
        args.image
    ).convert(
        "RGB"
    )

    model = (
        model_manager
        .get_classifier()
    )

    tensor = (
        preprocess_for_classifier(
            image,
            model_manager.device,
        )
    )

    result = (
        predict_coronary_view(
            model,
            tensor,
        )
    )

    print(
        "Device:",
        model_manager.device_name,
    )

    print(
        "Prediction:",
        result["label"],
    )

    print(
        "Confidence:",
        f"{result['confidence'] * 100:.2f}%",
    )

    print()

    print(
        "LCA:",
        f"{result['probabilities']['LCA'] * 100:.2f}%",
    )

    print(
        "RCA:",
        f"{result['probabilities']['RCA'] * 100:.2f}%",
    )

    print()


if __name__ == "__main__":
    main()