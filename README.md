# Arbor

**AI-assisted coronary artery analysis for angiography images**

Arbor is a research prototype that analyzes coronary angiography images to identify the coronary system, segment major coronary arteries, and generate artery-focused visualizations and relative vessel-width measurements.

The system combines a **ResNet-18 classifier**, an **FPN segmentation model**, a **FastAPI inference backend**, a **Next.js frontend**, and **Supabase** for case persistence.

---

## Overview

Coronary angiograms are visually dense and can be difficult to inspect quickly, especially when multiple vessels overlap in a 2D projection.

Arbor was designed around a simple workflow:

1. Upload a coronary angiography image.
2. Classify the angiogram as **LCA** or **RCA**.
3. Segment the relevant coronary arteries:
   - **LAD** — Left Anterior Descending
   - **LCX** — Left Circumflex
   - **RCA** — Right Coronary Artery
4. Generate multiple visualization modes:
   - Overlay
   - Focus
   - Isolated artery
   - Binary mask
   - Relative diameter profile
5. Persist the case and generated outputs in Supabase.

---

## Core Pipeline

```text
Coronary angiogram
        │
        ▼
Image validation + preprocessing
        │
        ├──────────────────────────────┐
        │                              │
        ▼                              ▼
ResNet-18 classifier              FPN segmenter
LCA / RCA                         LAD / LCX / RCA
        │                              │
        └──────────────┬───────────────┘
                       ▼
              Anatomical filtering
                       │
                       ▼
              Mask post-processing
                       │
        ┌──────────────┼───────────────┐
        ▼              ▼               ▼
     Overlay         Focus          Isolated
                       │
                       ▼
              Diameter profiling
                       │
                       ▼
                FastAPI response
                       │
                       ▼
                Next.js frontend
                       │
                       ▼
                    Supabase
```

---

## Model Architecture

### 1. LCA / RCA Classification

Arbor uses a **ResNet-18** image classifier.

**Input**
- RGB image
- `224 × 224`
- ImageNet-style normalization

```text
mean = [0.485, 0.456, 0.406]
std  = [0.229, 0.224, 0.225]
```

**Classes**

```text
0 → LCA
1 → RCA
```

The final fully connected layer of ResNet-18 is configured for two output classes.

### Classification Results

| Metric | Result |
|---|---:|
| Accuracy | **97.67%** |
| Precision | **94.29%** |
| Recall | **99.00%** |
| F1-score | **96.59%** |

Confusion matrix on the provided test split:

```text
                 Predicted
                 LCA   RCA
Actual LCA       194     6
Actual RCA         1    99
```

> These results are reported on the provided dataset test partition. Patient-level independence of the split was not independently verified during the hackathon.

---

### 2. Coronary Artery Segmentation

Arbor uses an **FPN (Feature Pyramid Network)** with a **ResNet-18 encoder** for multiclass semantic segmentation.

**Input**
- RGB image
- `512 × 512`

**Output classes**

```text
0 → Background
1 → LAD
2 → LCX
3 → RCA
```

The model produces per-pixel logits and the final class map is obtained using `argmax`.

### Segmentation Results

| Artery | Dice | IoU | Precision | Recall |
|---|---:|---:|---:|---:|
| LAD | 0.6731 | 0.5072 | 0.6519 | 0.6957 |
| LCX | 0.7036 | 0.5427 | 0.7521 | 0.6609 |
| RCA | 0.7606 | 0.6137 | 0.6859 | 0.8535 |
| **Macro Average** | **0.7124** | **0.5545** | **0.6967** | **0.7367** |

The classification and segmentation stages are kept modular so that each model can be evaluated and replaced independently.

---

## Visualization Modes

Arbor converts segmentation masks into clinician-friendly visual outputs.

### Overlay
Displays the predicted artery classes directly over the original angiogram.

### Focus
Highlights one selected artery while dimming the surrounding anatomy.

### Isolated
Keeps only the selected artery visible and removes the remaining background.

### Mask
Displays the raw binary segmentation mask used by the visualization pipeline.

---

## Relative Diameter Profiling

Arbor also derives a **relative vessel-width profile** directly from the segmentation mask.

```text
Binary artery mask
        ↓
Morphological skeletonization
        ↓
Approximate vessel centerline
        ↓
Euclidean distance transform
        ↓
Local radius estimate
        ↓
Diameter ≈ 2 × radius
```

For centerline point `i`:

```text
diameter_i ≈ 2 × distance_to_nearest_vessel_boundary_i
```

The current interface reports:
- Mean width
- Median width
- P20–P95 width range
- Relative width variation

Relative width variation is calculated as:

```text
(1 - P20 / Median) × 100
```

This is a **relative morphology indicator**, not a stenosis percentage.

Because standard PNG/JPEG images do not contain physical calibration, the current implementation reports diameter in **pixels**. Calibrated DICOM images or another known physical scale would be required for millimeter measurements.

---

## Tech Stack

### Machine Learning
- PyTorch
- Torchvision
- segmentation-models-pytorch
- OpenCV
- NumPy
- Pillow

### Backend
- FastAPI
- Uvicorn
- Python
- CUDA-enabled local inference

### Frontend
- Next.js
- React
- TypeScript

### Persistence
- Supabase
- Supabase Storage
- Saved analysis metadata and generated result images

---

## Backend API

### Analyze Image

```http
POST /analyze-image
Content-Type: multipart/form-data
```

Form field:

```text
file
```

Example response:

```json
{
  "analysis_id": "example-id",
  "coronary_view": {
    "label": "LCA",
    "confidence": 0.9974
  },
  "arteries_detected": ["LAD", "LCX"],
  "original_url": "...",
  "overlay_url": "...",
  "review_required": true,
  "model_version": "resnet18-lca-rca+fpn-resnet18-seg-v1",
  "processing_time_ms": 120
}
```

Each detected artery can also return:

```json
{
  "present": true,
  "mask_url": "...",
  "focus_url": "...",
  "isolated_url": "...",
  "diameter_overlay_url": "...",
  "diameter": {
    "unit": "px",
    "mean_px": 10.8,
    "median_px": 12.79,
    "p20_px": 5.6,
    "p95_px": 16.0,
    "relative_width_variation_pct": 56.2
  }
}
```

---

## Repository Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── ml/
│   │   ├── schemas/
│   │   └── services/
│   ├── model_weights/
│   ├── results/
│   ├── scripts/
│   └── pyproject.toml
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   └── package.json

```

---

## Running Locally

### Backend

From the `backend` directory:

```bash
uv sync
uv run uvicorn app.main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

### Frontend

From the `frontend` directory:

```bash
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

## Design Decisions

### Why separate classification and segmentation?

- **Classification:** Which coronary system is visible?
- **Segmentation:** Which pixels belong to each artery?

Keeping them independent provides:
- easier model evaluation
- easier model replacement
- clearer failure analysis
- future consistency checking between anatomical classification and segmentation

### Why local inference?

The prototype runs the PyTorch models locally rather than using a paid external inference API.

Benefits:
- no per-request model cost
- lower dependency on network connectivity
- faster local experimentation
- control over the inference pipeline

---

## Known Limitations

Arbor is currently a research prototype.

Current limitations include:
- Segmentation performance is not yet sufficient for autonomous clinical use.
- LAD/LCX class switching can occur at difficult branches or overlapping vessels.
- Coronary angiography is a 2D projection of 3D anatomy.
- The current segmentation taxonomy does not include a separate Left Main class.
- Diameter measurements are pixel-based unless calibrated image spacing is available.
- The system has not undergone prospective clinical validation.
- Reported metrics are experimental model-evaluation results, not clinical performance claims.

---

## Future Work

- topology-aware or graph-based artery labeling
- explicit Left Main segmentation
- vessel centerline graph construction
- improved branch continuity constraints
- calibrated DICOM support
- millimeter-scale diameter measurement
- longitudinal vessel profiling
- uncertainty estimation
- stronger patient-level validation
- external dataset evaluation
- clinically validated quantitative coronary analysis workflows

---

## Team

- **Aniket Dhingra** — Backend & ML Systems
- **Aadit Pandit** — Frontend
- **Arya Sharma** — Data Engineering
- **Alisha Savant** — Machine Learning & Evaluation

---

## Achievement

**1st Place — AI in Healthcare Track**

Arbor was developed as a hackathon prototype focused on combining practical ML inference, artery-specific segmentation, quantitative visualization, and an end-to-end usable interface.

---

## Disclaimer

**Arbor is a research and educational prototype. It is not a medical device and is not intended to provide diagnosis, treatment recommendations, or autonomous clinical decisions. All outputs require review by qualified healthcare professionals.**
