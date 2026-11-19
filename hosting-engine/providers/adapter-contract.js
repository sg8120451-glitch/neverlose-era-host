/**
 * Provider-independent contract for NEVERLOSE ERA execution providers.
 *
 * Adapters must provision isolated customer workloads. They must never run
 * untrusted project archives inside the hosting-engine API process.
 *
 * Implementations expose:
 *   capabilities() -> { runtimes, logs, environmentVariables, persistentStorage }
 *   start(project)  -> provider deployment metadata
 *   stop(project)   -> provider deployment metadata
 *   restart(project)-> provider deployment metadata
 *   status(project)-> normalized status
 *   logs(project, options) -> { lines, nextCursor }
 *
 * project is an already-authorized record loaded by the API after checking
 * owner_id. Do not accept owner IDs or provider resource IDs directly from
 * untrusted browser input.
 */

const REQUIRED_METHODS = [
  "capabilities",
  "start",
  "stop",
  "restart",
  "status",
  "logs"
];

export function assertProviderAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new TypeError("A hosting provider adapter is required.");
  }

  for (const method of REQUIRED_METHODS) {
    if (typeof adapter[method] !== "function") {
      throw new TypeError(`Hosting provider adapter is missing ${method}().`);
    }
  }

  return adapter;
}

export function normalizeProviderStatus(status) {
  const allowed = new Set([
    "queued",
    "provisioning",
    "starting",
    "running",
    "stopping",
    "stopped",
    "restarting",
    "failed",
    "suspended",
    "unknown"
  ]);

  return allowed.has(status) ? status : "unknown";
}
