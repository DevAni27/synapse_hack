import shutil

from time import perf_counter
from uuid import uuid4

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    Request,
    UploadFile,
)

from app.core.config import (
    settings,
)

from app.schemas.analysis import (
    AnalysisResponse,
    ArteryResult,
    CoronaryViewResult,
    HealthResponse,
    ModelInfoResponse,
    VideoAnalysisResponse,
    VideoInfo,
)

from app.services.inference import (
    run_analysis,
)

from app.services.validation import (
    read_and_validate_image,
    read_and_validate_video,
)

from app.services.video import (
    extract_best_frame,
)


router = APIRouter()


def _result_url(
    request: Request,
    analysis_id: str,
    filename: str | None,
) -> str | None:

    if filename is None:
        return None

    base_url = str(
        request.base_url
    ).rstrip("/")

    return (
        f"{base_url}"
        f"/results/"
        f"{analysis_id}/"
        f"{filename}"
    )


def _build_common_response(
    *,
    request: Request,
    analysis_id: str,
    image,
    result: dict,
    original_filename: str,
    elapsed_ms: int,
) -> dict:

    arteries = {

        name: ArteryResult(

            present=(
                data[
                    "present"
                ]
            ),

            mask_url=(
                _result_url(
                    request,
                    analysis_id,
                    data.get(
                        "mask_filename"
                    ),
                )
            ),

            isolated_url=(
                _result_url(
                    request,
                    analysis_id,
                    data.get(
                        "isolated_filename"
                    ),
                )
            ),

            focus_url=(
                _result_url(
                    request,
                    analysis_id,
                    data.get(
                        "focus_filename"
                    ),
                )
            ),

            diameter_overlay_url=(
                _result_url(
                    request,
                    analysis_id,
                    data.get(
                        "diameter_filename"
                    ),
                )
            ),

            diameter=(
                data.get(
                    "diameter"
                )
            ),

        )

        for name, data
        in result[
            "arteries"
        ].items()
    }

    return {

        "analysis_id":
            analysis_id,

        "coronary_view":
            CoronaryViewResult(

                label=result[
                    "view"
                ],

                confidence=result[
                    "confidence"
                ],
            ),

        "arteries":
            arteries,

        "arteries_detected": [

            name

            for (
                name,
                artery,
            )
            in arteries.items()

            if artery.present
        ],

        "original_url":
            _result_url(
                request,
                analysis_id,
                original_filename,
            ),

        "overlay_url":
            _result_url(
                request,
                analysis_id,
                result[
                    "overlay_filename"
                ],
            ),

        "review_required":
            result[
                "review_required"
            ],

        "model_version":
            result[
                "model_version"
            ],

        "processing_time_ms":
            elapsed_ms,

        "image": {
            "width":
                image.width,

            "height":
                image.height,
        },
    }


@router.get(
    "/health",
    response_model=HealthResponse,
)
async def health():

    return HealthResponse(

        status="ok",

        mock_mode=(
            settings.mock_mode
        ),

        results_dir=str(
            settings.results_dir
        ),
    )


@router.get(
    "/model-info",
    response_model=ModelInfoResponse,
)
async def model_info():

    return ModelInfoResponse(

        classifier=(
            "ResNet-18"
        ),

        segmenter=(
            "FPN-ResNet18"
        ),

        version=(
            "arbor-core-v1"
        ),

        device=(
            settings.device
        ),
    )


@router.post(
    "/analyze-image",
    response_model=(
        AnalysisResponse
    ),
)
async def analyze_image(
    request: Request,
    file: UploadFile = File(...),
):

    started = perf_counter()

    analysis_id = str(
        uuid4()
    )

    try:

        (
            image,
            original_bytes,
            extension,
        ) = (
            await
            read_and_validate_image(
                file
            )
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    analysis_dir = (
        settings.results_dir
        / analysis_id
    )

    analysis_dir.mkdir(
        parents=True,
        exist_ok=False,
    )

    original_path = (
        analysis_dir
        / f"original{extension}"
    )

    original_path.write_bytes(
        original_bytes
    )

    try:

        result = run_analysis(

            image=image,

            analysis_id=(
                analysis_id
            ),

            analysis_dir=(
                analysis_dir
            ),
        )

    except Exception as exc:

        shutil.rmtree(
            analysis_dir,
            ignore_errors=True,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Image analysis failed."
            ),
        ) from exc

    elapsed_ms = int(
        (
            perf_counter()
            - started
        )
        * 1000
    )

    payload = (
        _build_common_response(

            request=request,

            analysis_id=(
                analysis_id
            ),

            image=image,

            result=result,

            original_filename=(
                original_path.name
            ),

            elapsed_ms=(
                elapsed_ms
            ),
        )
    )

    return AnalysisResponse(
        **payload
    )


@router.post(
    "/analyze-video",
    response_model=(
        VideoAnalysisResponse
    ),
)
async def analyze_video(
    request: Request,
    file: UploadFile = File(...),
):

    started = perf_counter()

    analysis_id = str(
        uuid4()
    )

    try:

        (
            video_bytes,
            extension,
        ) = (
            await
            read_and_validate_video(
                file
            )
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    analysis_dir = (
        settings.results_dir
        / analysis_id
    )

    analysis_dir.mkdir(
        parents=True,
        exist_ok=False,
    )

    video_path = (
        analysis_dir
        / f"source_video{extension}"
    )

    video_path.write_bytes(
        video_bytes
    )

    try:

        frame_result = (
            extract_best_frame(

                video_path=(
                    video_path
                ),

                output_dir=(
                    analysis_dir
                ),

                max_sampled_frames=(
                    settings
                    .max_sampled_video_frames
                ),
            )
        )

        image = (
            frame_result.image
        )

        result = run_analysis(

            image=image,

            analysis_id=(
                analysis_id
            ),

            analysis_dir=(
                analysis_dir
            ),
        )

    except ValueError as exc:

        shutil.rmtree(
            analysis_dir,
            ignore_errors=True,
        )

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        shutil.rmtree(
            analysis_dir,
            ignore_errors=True,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Video analysis failed."
            ),
        ) from exc

    elapsed_ms = int(
        (
            perf_counter()
            - started
        )
        * 1000
    )

    payload = (
        _build_common_response(

            request=request,

            analysis_id=(
                analysis_id
            ),

            image=image,

            result=result,

            original_filename=(
                frame_result
                .frame_filename
            ),

            elapsed_ms=(
                elapsed_ms
            ),
        )
    )

    payload[
        "video"
    ] = VideoInfo(

        frame_count=(
            frame_result
            .frame_count
        ),

        fps=(
            frame_result.fps
        ),

        duration_seconds=(
            frame_result
            .duration_seconds
        ),

        sampled_frames=(
            frame_result
            .sampled_frames
        ),

        selected_frame_index=(
            frame_result
            .selected_frame_index
        ),

        selected_time_seconds=(
            frame_result
            .selected_time_seconds
        ),

        selected_frame_url=(
            _result_url(

                request,

                analysis_id,

                frame_result
                .frame_filename,
            )
        ),
    )

    return VideoAnalysisResponse(
        **payload
    )