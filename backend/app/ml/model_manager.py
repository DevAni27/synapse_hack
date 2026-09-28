import torch

from app.core.config import settings

from app.ml.classifier import (
    load_classifier,
)

from app.ml.segmenter import (
    load_segmenter,
)


def resolve_device() -> torch.device:

    requested = (
        settings.device
        .strip()
        .lower()
    )

    if requested == "auto":

        if torch.cuda.is_available():

            return torch.device(
                "cuda"
            )

        return torch.device(
            "cpu"
        )

    if requested == "cuda":

        if not torch.cuda.is_available():

            raise RuntimeError(
                "DEVICE=cuda was requested, "
                "but CUDA is unavailable."
            )

        return torch.device(
            "cuda"
        )

    if requested == "cpu":

        return torch.device(
            "cpu"
        )

    raise RuntimeError(
        "Unsupported DEVICE value: "
        f"{settings.device}"
    )


class ModelManager:

    def __init__(
        self,
    ) -> None:

        self.device = (
            resolve_device()
        )

        self._classifier = None

        self._segmenter = None

    @property
    def device_name(
        self,
    ) -> str:

        if (
            self.device.type
            == "cuda"
        ):

            return (
                torch.cuda
                .get_device_name(
                    0
                )
            )

        return "CPU"

    def get_classifier(
        self,
    ):

        if self._classifier is None:

            print(
                "[Arbor] Loading "
                "ResNet-18 classifier..."
            )

            self._classifier = (
                load_classifier(
                    checkpoint_path=(
                        settings
                        .classifier_checkpoint
                    ),

                    device=(
                        self.device
                    ),
                )
            )

            print(
                "[Arbor] Classifier "
                "loaded on "
                f"{self.device_name}."
            )

        return self._classifier

    def get_segmenter(
        self,
    ):

        if self._segmenter is None:

            checkpoint_path = (
                settings.model_dir
                / "segmenter"
                / "fpn_resnet18_best.pth"
            )

            print(
                "[Arbor] Loading "
                "FPN-ResNet18 segmenter..."
            )

            self._segmenter = (
                load_segmenter(
                    checkpoint_path=(
                        checkpoint_path
                    ),

                    device=(
                        self.device
                    ),
                )
            )

            print(
                "[Arbor] FPN segmenter "
                "loaded on "
                f"{self.device_name}."
            )

        return self._segmenter

    def info(
        self,
    ) -> dict:

        return {
            "device":
                str(
                    self.device
                ),

            "device_name":
                self.device_name,

            "cuda_available":
                torch.cuda.is_available(),

            "torch_version":
                torch.__version__,

            "classifier_loaded":
                self._classifier
                is not None,

            "segmenter_loaded":
                self._segmenter
                is not None,
        }


model_manager = ModelManager()