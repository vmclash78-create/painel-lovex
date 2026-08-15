// Node reports normal client cancellation (navigation, reload, closed tab) as
// `Error: aborted` / ECONNRESET. These are not application bugs and must never
// be surfaced as runtime errors, otherwise the preview shows a blank screen.
export function isExpectedClientDisconnect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const cause = "cause" in error ? error.cause : undefined;
  const causeCode =
    typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code: unknown }).code)
      : "";
  const errorCode =
    "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? String((error as { code?: unknown }).code)
      : "";

  const message = error.message.toLowerCase();
  return (
    causeCode === "ECONNRESET" ||
    causeCode === "ABORT_ERR" ||
    errorCode === "ECONNRESET" ||
    errorCode === "ABORT_ERR" ||
    error.name === "AbortError" ||
    message === "aborted" ||
    message.includes("aborted") && message.includes("request") ||
    message.includes("econnreset")
  );
}
