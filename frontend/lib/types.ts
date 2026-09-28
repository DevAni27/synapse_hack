/**
 * Types mirroring the backend's POST /analyze-image response.
 */

export type ArteryName = "LAD" | "LCX" | "RCA";

export type Artery = ArteryName;

export type CoronaryView = "LCA" | "RCA";


export interface DiameterResult {
  unit: "px";

  mean_px: number;

  median_px: number;

  p20_px: number;

  p95_px: number;

  relative_width_variation_pct: number;
}


export interface ArteryResult {
  present: boolean;

  mask_url: string | null;

  isolated_url: string | null;

  focus_url: string | null;

  diameter_overlay_url: string | null;

  diameter: DiameterResult | null;
}


export interface AnalysisResult {
  analysis_id: string;

  coronary_view: {
    label: CoronaryView;
    confidence: number;
  };

  arteries: Record<
    ArteryName,
    ArteryResult
  >;

  arteries_detected: ArteryName[];

  original_url: string;

  overlay_url: string;

  review_required: boolean;

  model_version: string;

  processing_time_ms: number;

  image: {
    width: number;
    height: number;
  };
}


export type ApiErrorKind =
  | "no_file"
  | "invalid_image"
  | "backend_unavailable"
  | "inference_failed"
  | "unknown";


export class ApiError extends Error {
  kind: ApiErrorKind;

  constructor(
    kind: ApiErrorKind,
    message: string
  ) {
    super(message);

    this.name =
      "ApiError";

    this.kind =
      kind;
  }
}