// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

import { isExpectedClientDisconnect } from "./client-disconnect";

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  // Client disconnects are expected noise, never an app crash.
  if (isExpectedClientDisconnect(error)) return;
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

// In dev (Node) an aborted HTTP request surfaces as an uncaughtException from
// node:_http_server (abortIncoming/socketOnClose). Swallow only that case so it
// does not bubble up as a runtime error / blank preview screen.
const nodeProcess = (globalThis as { process?: NodeJS.Process }).process;
if (nodeProcess && typeof nodeProcess.on === "function") {
  nodeProcess.on("uncaughtException", (error: unknown) => {
    if (isExpectedClientDisconnect(error)) return;
    record(error);
    console.error(error);
  });
  nodeProcess.on("unhandledRejection", (reason: unknown) => {
    if (isExpectedClientDisconnect(reason)) return;
    record(reason);
    console.error(reason);
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
