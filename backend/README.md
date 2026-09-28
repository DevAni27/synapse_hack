# Arbor Backend

Local FastAPI backend for Arbor.

## Endpoints

- `GET /health`
- `GET /model-info`
- `POST /analyze-image`
- `POST /analyze-video`

The current inference is mock-only so frontend/backend integration can be completed before trained model checkpoints arrive.

### Image

`POST /analyze-image` accepts PNG/JPEG.

### Video

`POST /analyze-video` accepts MP4/AVI/MOV/MKV.

The video pipeline:
1. samples up to 24 frames uniformly,
2. selects the highest-quality frame using a generic contrast/sharpness heuristic,
3. sends that frame through the same image-analysis pipeline,
4. returns normal Arbor analysis fields plus video metadata.

The frame-selection heuristic is not a medical AI score.

## Run

```powershell
Copy-Item .env.example .env
uv sync
uv run uvicorn app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000/docs
```
