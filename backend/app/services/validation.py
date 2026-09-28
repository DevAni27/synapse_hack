from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings


ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
}

ALLOWED_IMAGE_FORMATS = {
    "PNG": ".png",
    "JPEG": ".jpg",
}

ALLOWED_VIDEO_EXTENSIONS = {
    ".mp4",
    ".avi",
    ".mov",
    ".mkv",
}


async def read_and_validate_image(
    file: UploadFile,
) -> tuple[Image.Image, bytes, str]:
    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise ValueError(
            "Only PNG and JPEG angiography images "
            "are supported in the current prototype."
        )

    data = await file.read()

    if not data:
        raise ValueError("The uploaded image is empty.")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise ValueError(
            f"Image exceeds the {settings.max_upload_mb} MB "
            "upload limit."
        )

    try:
        with Image.open(BytesIO(data)) as probe:
            probe.verify()

        with Image.open(BytesIO(data)) as decoded:
            image_format = decoded.format
            image = decoded.convert("RGB")
            image.load()

    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError(
            "The uploaded file could not be decoded "
            "as a valid PNG or JPEG image."
        ) from exc

    extension = ALLOWED_IMAGE_FORMATS.get(
        image_format or "",
        ALLOWED_IMAGE_CONTENT_TYPES[file.content_type],
    )

    if image.width < 64 or image.height < 64:
        raise ValueError(
            "The uploaded image is too small for analysis."
        )

    return image, data, extension


async def read_and_validate_video(
    file: UploadFile,
) -> tuple[bytes, str]:
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError(
            "Only MP4, AVI, MOV, and MKV videos are supported."
        )

    data = await file.read()

    if not data:
        raise ValueError("The uploaded video is empty.")

    max_bytes = settings.max_video_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise ValueError(
            f"Video exceeds the {settings.max_video_mb} MB "
            "upload limit."
        )

    return data, extension
