import type { Artery } from "./types";

/**
 * These colours must match the FastAPI
 * visualization colours exactly.
 */
export const ARTERY_COLOR: Record<Artery, string> = {
  LAD: "#00B4FF", // blue / cyan
  LCX: "#BE50FF", // purple
  RCA: "#28DC78", // green
};

export const ARTERY_NAME: Record<Artery, string> = {
  LAD: "Left anterior descending",
  LCX: "Left circumflex",
  RCA: "Right coronary artery",
};

export const ARTERY_ORDER: Artery[] = [
  "LAD",
  "LCX",
  "RCA",
];