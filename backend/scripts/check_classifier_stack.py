from PIL import Image
import torch

from app.ml.classifier import (
    build_classifier,
)
from app.ml.model_manager import (
    model_manager,
)
from app.services.preprocessing import (
    preprocess_for_classifier,
)


def main() -> None:

    print()
    print("=== Arbor ML Stack Check ===")
    print()

    print(
        f"PyTorch: "
        f"{torch.__version__}"
    )

    print(
        f"CUDA available: "
        f"{torch.cuda.is_available()}"
    )

    print(
        f"Device: "
        f"{model_manager.device}"
    )

    print(
        f"GPU: "
        f"{model_manager.device_name}"
    )

    print()

    # Synthetic image only for infrastructure testing.
    image = Image.new(
        "RGB",
        (
            512,
            512,
        ),
        color="black",
    )

    tensor = preprocess_for_classifier(
        image,
        model_manager.device,
    )

    print(
        f"Input tensor shape: "
        f"{tuple(tensor.shape)}"
    )

    print(
        f"Tensor device: "
        f"{tensor.device}"
    )

    print()

    model = build_classifier(
        pretrained=False
    )

    model = model.to(
        model_manager.device
    )

    model.eval()

    with torch.inference_mode():

        logits = model(
            tensor
        )

    print(
        f"Output shape: "
        f"{tuple(logits.shape)}"
    )

    print(
        f"Output device: "
        f"{logits.device}"
    )

    print()

    if tuple(logits.shape) != (
        1,
        2,
    ):

        raise RuntimeError(
            "Unexpected classifier "
            "output shape."
        )

    print(
        "✓ Arbor ConvNeXt classifier "
        "successfully ran on GPU."
    )

    print()


if __name__ == "__main__":
    main()