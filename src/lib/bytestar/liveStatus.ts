// Live status copy for the SuperByte panel — what the pioneer is doing NOW.
//
// Pattern source: Hugging Face Chat UI emits fine-grained MessageUpdate status
// during generation; transformers.js React tutorials surface initiate→progress
// →complete. SuperByte never becomes a chat, but staff still need a present-
// tense account of the layer speaking (pioneer vs local instrument) and whether
// a read is in flight. Strings are deterministic; no model self-grading.

export type SuperByteDeployStatus = "unknown" | "unreachable" | "off" | "on";
export type SuperByteFeedbackSource = "pioneer" | "instrument" | null;

export function superbyteLiveStatus(args: {
  draftLen: number;
  minChars: number;
  deploy: SuperByteDeployStatus;
  observing: boolean;
  feedbackSource: SuperByteFeedbackSource;
  observationCount: number;
}): string {
  const { draftLen, minChars, deploy, observing, feedbackSource, observationCount } = args;
  if (draftLen === 0) return "Waiting for you to start writing.";
  if (observing) return "Reading the draft…";
  if (draftLen < minChars) {
    return "Waiting until the draft is long enough to analyze.";
  }
  if (feedbackSource === "pioneer" && observationCount > 0) {
    return observationCount === 1
      ? "Pioneer read complete — 1 observation."
      : `Pioneer read complete — ${observationCount} observations.`;
  }
  if (feedbackSource === "instrument" && observationCount > 0) {
    return observationCount === 1
      ? "Local gauges speaking — 1 instrument reading."
      : `Local gauges speaking — ${observationCount} instrument readings.`;
  }
  if (deploy === "off") {
    return "Pioneer dark on this deployment — gauges still run locally.";
  }
  if (deploy === "unreachable") {
    return "Could not reach the pioneer — gauges still run locally.";
  }
  if (deploy === "unknown") return "Checking whether the pioneer is open…";
  return "Drift gauges are live. Pioneer observations appear as the draft settles.";
}

/** Glanceable layer chip — mirrors HF Chat UI RouterMetadata (which route spoke). */
export function superbyteLayerLabel(
  feedbackSource: SuperByteFeedbackSource,
  observing: boolean,
  deploy: SuperByteDeployStatus
): { label: string; tone: "pioneer" | "instrument" | "reading" | "dark" | "idle" } {
  if (observing) return { label: "Reading", tone: "reading" };
  if (feedbackSource === "pioneer") return { label: "Pioneer", tone: "pioneer" };
  if (feedbackSource === "instrument") return { label: "Instrument", tone: "instrument" };
  if (deploy === "off") return { label: "Pioneer dark", tone: "dark" };
  if (deploy === "unreachable") return { label: "Pioneer unreachable", tone: "dark" };
  return { label: "Standing by", tone: "idle" };
}
