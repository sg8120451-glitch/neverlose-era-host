# NEVERLOSE ERA execution worker deployment

## Current state

This service is a fail-closed control adapter. It does not execute uploaded archives. Keep `EXECUTION_ENABLED=false` and do not configure `EXECUTION_WORKER_URL` on the hosting API until the isolated runtime has passed the checks below.

## Hosting constraint

The worker needs a dedicated Linux VM or equivalent container host with a supported container runtime and host-level network policy. A normal serverless web service is not enough: the worker must supervise long-running bot processes and isolate each customer's code.

Cloudflare's current Sandbox/Containers offering is documented as Workers Paid, so it does not meet the project's no-payment requirement. Short-lived code sandboxes are also not a replacement for persistent Discord bots.

## Required architecture

- Keep the public website and hosting API separate from the execution host.
- Expose the worker API only over HTTPS and authenticate every request with a long random bearer token.
- Keep the container runtime socket and host control credentials off the public API and out of customer containers.
- Run each project in its own non-root container with fixed CPU, memory, PID, disk, file-count, and lifetime limits.
- Use a read-only base filesystem, no-new-privileges, all Linux capabilities dropped, no host namespaces, and only a dedicated per-project writable directory.
- Validate ZIP paths, symlinks, file counts, compressed/uncompressed sizes, and extraction destinations before writing files.
- Never run package lifecycle scripts during dependency installation. Require a supported lockfile and cap install time/output.
- Do not pass Supabase credentials, worker tokens, API credentials, or other platform secrets into project containers.
- Apply host-level egress filtering. A normal Docker bridge is not sufficient for hostile code because it may reach private services or cloud metadata. The policy must permit the destinations needed for Discord bots while denying loopback, private, link-local, metadata, and control-plane networks, including IPv6 equivalents.
- Enforce per-owner project/concurrency quotas, bounded logs, cleanup of expired/stale containers, and ownership checks on every action.

## Deployment prerequisites

1. A dedicated Linux host with Docker Engine (or a runtime providing equivalent isolation).
2. Host firewall/egress policy tested from inside a disposable container.
3. A private worker address or tightly restricted ingress path.
4. HTTPS termination and a randomly generated worker token stored only in host environment secrets.
5. Persistent storage with per-project quotas and a cleanup policy.
6. A monitoring/alerting path for CPU, memory, disk, process count, and worker health.

## Environment

- `PORT`: HTTP port, default 3100.
- `SUPABASE_URL`: exact Supabase project origin used to validate signed upload URLs.
- `EXECUTION_WORKER_TOKEN`: long random secret; never commit it.
- `EXECUTION_ENABLED`: must remain `false` until the complete isolation and egress controls above are implemented, reviewed, and tested.

## Release gate

Do not enable execution merely because the worker reports healthy. First test malicious ZIP inputs, cross-project access, resource exhaustion, log/output limits, container cleanup, restart recovery, and network attempts to private/metadata destinations. Then test a benign Node.js Discord bot and verify Start, Stop, Restart, Status, and Logs end-to-end.
