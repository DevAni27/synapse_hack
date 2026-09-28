import { ApiError, type AnalysisResult } from "./types";

/** Never hardcode URLs in components: everything goes through here. Set it in .env.local. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

/** The backend may return relative URLs like /results/<id>/overlay.png; prefix them with the API origin. */
export function resolveAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Please choose a PNG or JPG image.";
  if (file.size > MAX_UPLOAD_BYTES) return "That file is over 10 MB. Please choose a smaller image.";
  return null;
}

/** FastAPI errors are { detail: string } or, for 422s, { detail: [{ msg }] }. */
function extractDetail(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msgs = d
        .map((x) => (x && typeof x === "object" && "msg" in x ? String((x as { msg: unknown }).msg) : ""))
        .filter(Boolean);
      if (msgs.length) return msgs.join("; ");
    }
  }
  return fallback;
}

/** POST /analyze-image as multipart/form-data (field "file"). Content-Type is left to the browser. */
export async function analyzeImage(file: File): Promise<AnalysisResult> {
  const problem = validateFile(file);
  if (problem) throw new ApiError("invalid_image", problem);

  if (!API_URL) {
    throw new ApiError("backend_unavailable", "NEXT_PUBLIC_API_URL is not set. Add it to .env.local and restart the dev server.");
  }

  const formData = new FormData();
  formData.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/analyze-image`, { method: "POST", body: formData });
  } catch {
    throw new ApiError("backend_unavailable", "Could not reach the analysis server. Is the backend running?");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const kind = res.status >= 500 ? "inference_failed" : "invalid_image";
    throw new ApiError(kind, extractDetail(body, "Analysis failed"));
  }

  return body as AnalysisResult;
}