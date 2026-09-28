from PIL import Image

import torch
from torchvision import transforms


CLASSIFIER_IMAGE_SIZE = 224


_classifier_transform = (
    transforms.Compose(
        [
            transforms.Resize(
                (
                    CLASSIFIER_IMAGE_SIZE,
                    CLASSIFIER_IMAGE_SIZE,
                )
            ),

            transforms.ToTensor(),

            transforms.Normalize(
                mean=[
                    0.485,
                    0.456,
                    0.406,
                ],
                std=[
                    0.229,
                    0.224,
                    0.225,
                ],
            ),
        ]
    )
)


def preprocess_for_classifier(
    image: Image.Image,
    device: torch.device,
) -> torch.Tensor:
    """
    Match the preprocessing used during training.

    Input:
        PIL image

    Output:
        [1, 3, 224, 224] tensor
    """

    image = image.convert(
        "RGB"
    )

    tensor = (
        _classifier_transform(
            image
        )
    )

    tensor = tensor.unsqueeze(
        0
    )

    return tensor.to(
        device,
        non_blocking=True,
    )