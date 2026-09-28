import type { ApiError } from "@/lib/types";

const TITLES: Record<ApiError["kind"], string> = {
  no_file: "No image selected",
  invalid_image: "That image can't be analysed",
  backend_unavailable: "Can't reach the analysis server",
  inference_failed: "The analysis failed",
  unknown: "Something went wrong",
};

export function ErrorBox({
  error,
  onRetry,
  onReset,
}: {
  error: ApiError;
  onRetry?: () => void;
  onReset: () => void;
}) {
  return (
    <div role="alert" className="rise border border-lad/60 bg-lad/5 p-5" style={{ borderColor: "color-mix(in srgb, var(--lad) 55%, transparent)" }}>
      <p className="label" style={{ color: "var(--lad)" }}>
        {TITLES[error.kind]}
      </p>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-text">{error.message}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {onRetry && error.kind !== "invalid_image" && (
          <button
            onClick={onRetry}
            className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          >
            Retry
          </button>
        )}
        <button
          onClick={onReset}
          className="border border-line px-4 py-2 text-sm text-text transition-colors hover:border-muted"
        >
          Choose a different image
        </button>
      </div>
    </div>
  );
}
