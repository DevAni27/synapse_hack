from pathlib import Path

import numpy as np
import torch
from PIL import Image

import segmentation_models_pytorch as smp
import torch.nn.functional as F

INPUT_SIZE = (
    512,
    512,
)

NUM_CLASSES = 4

CLASS_NAMES = {
    0: "Background",
    1: "LAD",
    2: "LCX",
    3: "RCA",
}

MEAN = np.array(
    [
        0.485,
        0.456,
        0.406,
    ],
    dtype=np.float32,
)

STD = np.array(
    [
        0.229,
        0.224,
        0.225,
    ],
    dtype=np.float32,
)


def build_segmenter():
    """
    Recreate the exact FPN architecture used
    during training.
    """

    return smp.FPN(
        encoder_name="resnet18",
        encoder_weights=None,
        in_channels=3,
        classes=NUM_CLASSES,
        activation=None,
    )


def load_segmenter(
    checkpoint_path: Path,
    device: torch.device,
):
    """
    Load Alisha's trained FPN-ResNet18 checkpoint.
    """

    if not checkpoint_path.exists():

        raise FileNotFoundError(
            "FPN segmentation checkpoint "
            f"not found: {checkpoint_path}"
        )

    model = build_segmenter()

    checkpoint = torch.load(
        checkpoint_path,
        map_location=device,
        weights_only=True,
    )

    if (
        isinstance(
            checkpoint,
            dict,
        )
        and "model_state_dict"
        in checkpoint
    ):
        state_dict = checkpoint[
            "model_state_dict"
        ]

    else:
        state_dict = checkpoint

    # Training wrapped SMP FPN as:
    #
    # self.model = smp.FPN(...)
    #
    # so weights contain:
    #
    # model.encoder...
    #
    # whereas standalone SMP expects:
    #
    # encoder...

    if all(
        key.startswith("model.")
        for key in state_dict.keys()
    ):

        state_dict = {
            key[len("model."):]:
                value

            for key, value
            in state_dict.items()
        }

    model.load_state_dict(
        state_dict,
        strict=True,
    )

    model = model.to(
        device
    )

    model.eval()

    return model


@torch.inference_mode()
@torch.inference_mode()
def predict_segmentation(
    model,
    image: Image.Image,
    device: torch.device,
    coronary_view: str,
) -> np.ndarray:
    """
    Predict anatomically constrained coronary segmentation.

    Classes:
        0 = Background
        1 = LAD
        2 = LCX
        3 = RCA

    Improvements over raw argmax:
        1. Uses ResNet LCA/RCA classification as
           an anatomical constraint.
        2. Spatially smooths artery probabilities
           to reduce label switching along the
           same continuous vessel.
    """

    image = image.convert(
        "RGB"
    )

    image = image.resize(
        INPUT_SIZE,
        Image.Resampling.BILINEAR,
    )

    image_np = (
        np.asarray(image)
        .astype(np.float32)
        / 255.0
    )

    image_np = (
        image_np
        - MEAN
    ) / STD

    image_tensor = (
        torch.from_numpy(
            image_np.transpose(
                2,
                0,
                1,
            )
        )
        .float()
        .unsqueeze(0)
        .to(device)
    )

    # ----------------------------------
    # FPN prediction
    # ----------------------------------

    logits = model(
        image_tensor
    )

    probabilities = torch.softmax(
        logits,
        dim=1,
    )

    # Raw prediction is useful for deciding
    # whether a pixel belongs to a coronary
    # vessel at all.

    raw_prediction = torch.argmax(
        probabilities,
        dim=1,
    )

    vessel_mask = (
        raw_prediction != 0
    )

    # Start everything as background.
    prediction = torch.zeros_like(
        raw_prediction
    )

    # ==================================
    # LCA
    # ==================================

    if coronary_view == "LCA":

        # Only LAD and LCX are anatomically
        # relevant for an LCA angiogram.

        artery_probabilities = (
            probabilities[
                :,
                1:3,
                :,
                :,
            ]
        )

        # Spatial smoothing reduces rapid
        # LAD <-> LCX switching along the
        # same vessel.
        #
        # 9x9 is intentionally conservative.

        artery_probabilities = (
            F.avg_pool2d(
                artery_probabilities,
                kernel_size=9,
                stride=1,
                padding=4,
            )
        )

        # Returns:
        #
        # 0 -> LAD probability wins
        # 1 -> LCX probability wins

        artery_prediction = (
            torch.argmax(
                artery_probabilities,
                dim=1,
            )
            + 1
        )

        prediction[
            vessel_mask
        ] = artery_prediction[
            vessel_mask
        ]

    # ==================================
    # RCA
    # ==================================

    elif coronary_view == "RCA":

        # Once the independent classifier has
        # identified RCA, all coronary vessel
        # pixels in this view belong to the RCA
        # system.

        prediction[
            vessel_mask
        ] = 3

    else:

        raise ValueError(
            "coronary_view must "
            "be LCA or RCA"
        )

    prediction = (
        prediction[0]
        .cpu()
        .numpy()
        .astype(np.uint8)
    )

    return prediction