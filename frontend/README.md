# Arbor · frontend

Frontend for **Arbor**, Quadruple A's coronary angiogram analyser (LCA/RCA identification and LAD / LCX / RCA
segmentation). Owner: Aadit. Built against the API contract in `Coronary_AI_Core_Build_Plan.md` (Sections 5.I and 11).

**Research prototype. Not for diagnosis.**

## Run it

```bash
npm install
cp .env.example .env.local     # first time only
npm run dev                    # http://localhost:3000
```

Works out of the box in **mock mode**, with no backend needed.

| Route      | What it is |
|------------|------------|
| `/`        | Scroll-driven 3D intro (heart → dive into a coronary artery → upload panel) |
| `/analyse` | The same analyser as a plain page. Use this for quick testing or if the 3D intro misbehaves on a machine |

## Environment variables

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | Aniket's backend, e.g. `http://localhost:8000` (no trailing slash). Never hardcode URLs in components |
| `NEXT_PUBLIC_MOCK_MODE` | `true` = built-in placeholder responses. `false` = call the real backend |
| `NEXT_PUBLIC_MASK_FORMAT` | `alpha` (mask PNG transparent except the artery) or `luminance` (black/white, white = artery). **Confirm with Aniket** |
| `NEXT_PUBLIC_HEART_MODEL` | Optional, e.g. `/models/heart.glb`, to use a real 3D heart instead of the procedural one |

`NEXT_PUBLIC_*` values are baked in at build time: restart `npm run dev` after changing them.

## Mock mode

The synthetic sample images are **not real angiograms**; they are drawn curves so the UI can be built and demoed.
Open "Demo mode · placeholder samples" under the upload box for one-click samples: LCA, RCA, invalid image,
server offline, model failure. Any file you upload yourself also gets a mock result; put `rca` in the file name to
get the RCA result (`bad`, `offline` and `fail` trigger the error states).

Regenerate the placeholder images with `python3 scripts/make_mock_images.py` (needs Pillow and NumPy).

## Talking to the real backend

Set `NEXT_PUBLIC_MOCK_MODE=false` and `NEXT_PUBLIC_API_URL=...`. The client (`lib/api.ts`):

- POSTs `multipart/form-data` with field `file` to `POST {API_URL}/analyze-image`
- prefixes relative URLs such as `/results/<id>/lad.png` with `NEXT_PUBLIC_API_URL`
- for any non-2xx response, shows the backend's `detail` text (string, or FastAPI's 422 list of `msg`)
- separates "can't reach server" (network error) from "invalid image" (4xx) and "model failed" (5xx)

Things Aniket's side needs for this to work (raise them with him):

1. **CORS** allowing the frontend origin (`http://localhost:3000`), including for the `/results/...` static files
2. **Mask PNGs** the same pixel size as the original image, transparent except the artery (or set `luminance`)
3. `image.width/height` in the response (present in plan Section 5, missing in Section 11; the frontend works without it)
4. Result files kept long enough to fetch. Per Aniket, `/results/<id>/` is temporary, so the frontend must copy
   the overlay + masks to Supabase Storage right after each analysis (not built yet)

## Where things are

```
app/                    routes: / (intro), /analyse
components/analyser/    Analyser (state machine), DropZone, ResultsView, ErrorBox
components/intro/       Intro (scroll + chapters), HeartScene (three.js scene)
lib/api.ts              the only place that talks to the backend
lib/types.ts            API response types: edit here if the contract changes
lib/mock.ts             mock responses
lib/heart.ts            procedural placeholder heart
lib/introPath.ts        camera path + chapter timing for the intro
public/mock/            synthetic placeholder images
```

The results screen has a hidden `#findings` section reserved for the narrowing flag, territory map and report
features, so they can be added later without redesigning the page.

## The 3D intro

- The camera follows one curve (`lib/introPath.ts`). The tunnel wall, chapter timing and camera all derive from it.
- The heart is a real anatomical model, `public/models/heart.glb` (CC BY 4.0, credit in `public/models/CREDITS.md`
  and the footer). It is re-coloured and lit in code. To swap it, replace the file (or set `NEXT_PUBLIC_HEART_MODEL`);
  if the procedural fallback shows, the file failed to load.
- Falls back to a static hero + upload card when WebGL is unavailable or the user prefers reduced motion.
- Keep a "Skip intro" route (`/analyse`) for demos on unfamiliar hardware.

## Not built yet

Database and Supabase (deferred by agreement), doctor/patient login, saved cases, narrowing flag, territory map, reports.
