import os

from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[2]

load_dotenv(
    BACKEND_ROOT / ".env"
)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _csv_env(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [
        item.strip()
        for item in raw.split(",")
        if item.strip()
    ]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Arbor Backend")
    app_env: str = os.getenv("APP_ENV", "development")
    mock_mode: bool = _env_bool("MOCK_MODE", True)

    device: str = os.getenv("DEVICE", "auto")
    classifier_name: str = os.getenv(
        "CLASSIFIER_NAME",
        "convnext_tiny",
    )
    segmenter_name: str = os.getenv(
        "SEGMENTER_NAME",
        "nnunetv2_2d",
    )
    model_version: str = os.getenv(
        "MODEL_VERSION",
        "core-v1",
    )
    

    max_upload_mb: int = int(
        os.getenv("MAX_UPLOAD_MB", "20")
    )
    max_video_mb: int = int(
        os.getenv("MAX_VIDEO_MB", "200")
    )
    max_sampled_video_frames: int = int(
        os.getenv("MAX_SAMPLED_VIDEO_FRAMES", "24")
    )

    results_dir: Path = (
        BACKEND_ROOT
        / os.getenv("RESULTS_DIR", "results")
    ).resolve()

    model_dir: Path = (
        BACKEND_ROOT
        / os.getenv("MODEL_DIR", "model_weights")
    ).resolve()
    
    classifier_checkpoint: Path = (
            BACKEND_ROOT
            / os.getenv(
                "CLASSIFIER_CHECKPOINT",
                (
                    "model_weights/"
                    "classifier/"
                    "lca_rca_resnet18.pt"
                ),
            )
    ).resolve()

    cors_origins: list[str] = None

    def __post_init__(self):
        object.__setattr__(
            self,
            "cors_origins",
            _csv_env(
                "CORS_ORIGINS",
                "http://localhost:3000,"
                "http://127.0.0.1:3000",
            ),
        )

    def ensure_directories(self) -> None:
        self.results_dir.mkdir(
            parents=True,
            exist_ok=True,
        )
        self.model_dir.mkdir(
            parents=True,
            exist_ok=True,
        )


settings = Settings()
