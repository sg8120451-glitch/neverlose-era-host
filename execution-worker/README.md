# NEVERLOSE ERA isolated execution worker

This service is intentionally NOT enabled for arbitrary code execution yet.

## Worker contract
The API adapter in hosting-engine/routes.js calls authenticated POST endpoints: /v1/projects/start, /stop, /restart, /status, and /logs. The worker must verify the shared bearer token, validate every field, and never trust a project ID as a filesystem path or container name.

## Mandatory isolation before enabling execution
1. Use a dedicated host, not the public API process.
2. Run one container per project with no privileged mode, no host PID/IPC/network namespaces, no host filesystem mounts, dropped Linux capabilities, no-new-privileges, non-root UID, read-only root filesystem, bounded writable temporary storage, memory/CPU/PID limits, and execution timeout.
3. Do not expose the Docker socket to an internet-facing API. Keep the runtime API private and restrict it to this worker.
4. Limit archive download size and time; allow only the configured Supabase Storage origin; reject redirects to other hosts.
5. Reject ZIP path traversal, symlinks, excessive file counts, and decompression bombs.
6. Do not run package lifecycle scripts during dependency installation. Require a lockfile and apply dependency/network policy.
7. Keep logs bounded, redact secrets, and never return environment variables in status/log endpoints.
8. Enforce per-user limits and stop containers on worker restart or lease expiry.
9. Keep execution disabled until these controls are implemented and tested.

## Environment
PORT is the HTTP port. EXECUTION_WORKER_TOKEN is a long random shared secret and must never be committed. EXECUTION_ENABLED must remain false until all isolation controls are implemented and reviewed.

## Request validation implemented
- The API refuses to send its shared token to a worker URL unless the configured URL is HTTPS and contains no embedded credentials, query, or fragment.
- The worker validates action names, project/owner IDs, Node.js runtime, project name, and signed archive URL origin/path before accepting a request.
- The archive URL must use the configured Supabase project origin and the signed `bot-uploads` storage path.
- These checks do not make uploaded code safe to execute; the worker still fails closed and does not start containers.

## Current status
This folder documents the worker boundary. It is not yet a runnable hosting provider and bots cannot start. No paid provider has been selected.