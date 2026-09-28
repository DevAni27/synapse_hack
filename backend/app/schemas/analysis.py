from typing import Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    Field,
)


class HealthResponse(BaseModel):
    status: Literal["ok"]

    mock_mode: bool

    results_dir: str


class ModelInfoResponse(BaseModel):
    classifier: str

    segmenter: str

    version: str

    device: str


class CoronaryViewResult(BaseModel):
    label: Literal[
        "LCA",
        "RCA",
    ]

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )


class DiameterResult(BaseModel):
    unit: Literal["px"]

    mean_px: float

    median_px: float

    p20_px: float

    p95_px: float

    # Accept both the old backend name
    # and our newer frontend/API name.
    relative_width_variation_pct: float = Field(
        validation_alias=AliasChoices(
            "relative_width_variation_pct",
            "relative_width_drop_pct",
        )
    )


class ArteryResult(BaseModel):
    present: bool

    mask_url: str | None = None

    isolated_url: str | None = None

    focus_url: str | None = None

    diameter_overlay_url: str | None = None

    diameter: DiameterResult | None = None


class AnalysisResponse(BaseModel):
    analysis_id: str

    coronary_view: CoronaryViewResult

    arteries: dict[
        str,
        ArteryResult,
    ]

    arteries_detected: list[str]

    original_url: str

    overlay_url: str

    review_required: bool

    model_version: str

    processing_time_ms: int

    image: dict[
        str,
        int,
    ]


class VideoInfo(BaseModel):
    frame_count: int

    fps: float

    duration_seconds: float

    sampled_frames: int

    selected_frame_index: int

    selected_time_seconds: float

    selected_frame_url: str


class VideoAnalysisResponse(
    AnalysisResponse
):
    video: VideoInfo