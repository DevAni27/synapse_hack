from pathlib import Path

import torch
from torch import nn
from torchvision import models


CLASS_NAMES = (
    "LCA",
    "RCA",
)


def build_classifier() -> nn.Module:
    """
    Build the exact ResNet-18 architecture used
    during Arbor classifier training.
    """

    model = models.resnet18(
        weights=None
    )

    model.fc = nn.Linear(
        model.fc.in_features,
        len(CLASS_NAMES),
    )

    return model


def _extract_state_dict(
    checkpoint,
) -> dict:
    """
    Support both a raw state_dict and common
    wrapped checkpoint formats.
    """

    if isinstance(checkpoint, dict):

        if "model_state_dict" in checkpoint:
            return checkpoint[
                "model_state_dict"
            ]

        if "state_dict" in checkpoint:
            return checkpoint[
                "state_dict"
            ]

    return checkpoint


def _clean_state_dict(
    state_dict: dict,
) -> dict:
    """
    Remove DataParallel 'module.' prefixes if present.
    """

    cleaned = {}

    for key, value in state_dict.items():

        cleaned_key = (
            key.removeprefix("module.")
        )

        cleaned[
            cleaned_key
        ] = value

    return cleaned


def load_classifier(
    checkpoint_path: Path,
    device: torch.device,
) -> nn.Module:
    """
    Load Arbor's trained LCA/RCA ResNet-18 model.
    """

    if not checkpoint_path.exists():

        raise FileNotFoundError(
            "Arbor classifier checkpoint "
            f"not found: {checkpoint_path}"
        )

    model = build_classifier()

    checkpoint = torch.load(
        checkpoint_path,
        map_location=device,
        weights_only=True,
    )

    state_dict = _extract_state_dict(
        checkpoint
    )

    state_dict = _clean_state_dict(
        state_dict
    )

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
def predict_coronary_view(
    model: nn.Module,
    tensor: torch.Tensor,
) -> dict:
    """
    Predict whether the angiogram shows
    LCA or RCA.
    """

    logits = model(
        tensor
    )

    probabilities = torch.softmax(
        logits,
        dim=1,
    )

    predicted_index = int(
        probabilities
        .argmax(dim=1)
        .item()
    )

    confidence = float(
        probabilities[
            0,
            predicted_index,
        ].item()
    )

    return {
        "class_id":
            predicted_index,

        "label":
            CLASS_NAMES[
                predicted_index
            ],

        "confidence":
            confidence,

        "probabilities": {
            CLASS_NAMES[i]:
                float(
                    probabilities[
                        0,
                        i,
                    ].item()
                )
            for i
            in range(
                len(CLASS_NAMES)
            )
        },
    }