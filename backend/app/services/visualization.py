from pathlib import Path

from PIL import Image, ImageEnhance


ARTERY_COLORS: dict[str, tuple[int, int, int]] = {
    "LAD": (0, 180, 255),
    "LCX": (190, 80, 255),
    "RCA": (40, 220, 120),
}


def _binary_mask(
    mask: Image.Image,
    size: tuple[int, int],
) -> Image.Image:
    """
    Convert any segmentation mask into a clean
    binary 0/255 mask at the original image size.
    """

    mask = mask.convert("L")

    if mask.size != size:
        mask = mask.resize(
            size,
            Image.Resampling.NEAREST,
        )

    return mask.point(
        lambda value:
        255 if value >= 128 else 0
    )


def save_isolated_artery(
    *,
    original: Image.Image,
    mask: Image.Image,
    output_path: Path,
) -> None:
    """
    Keep only the selected artery visible.

    Everything outside the artery segmentation
    becomes black.
    """

    original_rgb = original.convert(
        "RGB"
    )

    clean_mask = _binary_mask(
        mask,
        original_rgb.size,
    )

    background = Image.new(
        "RGB",
        original_rgb.size,
        (0, 0, 0),
    )

    isolated = Image.composite(
        original_rgb,
        background,
        clean_mask,
    )

    isolated.save(
        output_path,
        format="PNG",
    )


def save_focus_view(
    *,
    original: Image.Image,
    mask: Image.Image,
    artery_name: str,
    output_path: Path,
) -> None:
    """
    Keep anatomical context but visually emphasize
    one selected artery.

    Background:
        heavily dimmed

    Selected artery:
        bright + lightly color accented
    """

    original_rgb = original.convert(
        "RGB"
    )

    clean_mask = _binary_mask(
        mask,
        original_rgb.size,
    )

    # Dim everything outside the selected artery.
    dimmed = ImageEnhance.Brightness(
        original_rgb
    ).enhance(
        0.18
    )

    color = ARTERY_COLORS.get(
        artery_name,
        (255, 255, 0),
    )

    color_layer = Image.new(
        "RGB",
        original_rgb.size,
        color,
    )

    # Preserve vessel texture while adding
    # a subtle artery-specific color.
    accented = Image.blend(
        original_rgb,
        color_layer,
        alpha=0.35,
    )

    focus = Image.composite(
        accented,
        dimmed,
        clean_mask,
    )

    focus.save(
        output_path,
        format="PNG",
    )


def save_combined_overlay(
    *,
    original: Image.Image,
    masks: dict[str, Image.Image],
    output_path: Path,
) -> None:
    """
    Overlay every detected artery over the
    original angiogram.
    """

    base = original.convert(
        "RGBA"
    )

    for artery_name, mask in masks.items():

        clean_mask = _binary_mask(
            mask,
            base.size,
        )

        color = ARTERY_COLORS.get(
            artery_name,
            (255, 255, 0),
        )

        layer = Image.new(
            "RGBA",
            base.size,
            (
                color[0],
                color[1],
                color[2],
                150,
            ),
        )

        base = Image.composite(
            layer,
            base,
            clean_mask,
        )

    base.convert(
        "RGB"
    ).save(
        output_path,
        format="PNG",
    )