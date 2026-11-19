# Provider-independent hosting adapters

NEVERLOSE ERA's control plane should depend on a small provider adapter
contract, not on one vendor's API.

## Current state

- The existing production execution routes remain fail-closed.
- `adapter-contract.js` defines the normalized provider interface.
- `simulation-adapter.js` is a development-only mock for UI and workflow
  testing. It does not download ZIPs, install dependencies, launch processes,
  or execute customer code.
- Simulation state is in-memory only and is lost when the API restarts.
- Do not set `EXECUTION_WORKER_URL` or `EXECUTION_WORKER_TOKEN` to enable
  execution until a real isolated worker has been deployed and independently
  reviewed.

## Adapter contract

Every real adapter must implement:

- `capabilities()`
- `start(authorizedProject)`
- `stop(authorizedProject)`
- `restart(authorizedProject)`
- `status(authorizedProject)`
- `logs(authorizedProject, options)`

The API must first authenticate the user and load the project with an
`owner_id = request.user.id` filter. Only that verified project record may
be passed to an adapter. Never trust a browser-supplied owner ID or provider
resource ID.

## Requirements before a real provider is connected

1. Written permission for commercial, multi-customer hosting and API
   provisioning under the provider's current terms.
2. A separate isolated container or microVM per customer workload.
3. CPU, memory, process, disk, and runtime quotas.
4. Safe archive extraction with path traversal, symlink, and decompression
   bomb defenses.
5. No privileged container, host mounts, Docker socket, or shared API secrets
   exposed to customer code.
6. Egress controls that block private, link-local, metadata, and control-plane
   networks while allowing only the outbound services required by the bot.
7. Per-customer environment secrets, never included in ZIPs or logs.
8. Bounded logs, lifecycle cleanup, audit events, and ownership checks on
   every operation.
9. Billing/trial enforcement on the control plane, with suspension that does
   not silently delete customer data.

## Trial and subscription design

The intended product policy is a 30-day trial, then a paid subscription,
with no advertisements. Keep payment collection and paid activation disabled
until a permitted billing provider and the account eligibility requirements
are confirmed. Store trial start/end and subscription state server-side;
never trust a client clock or a browser-supplied plan status.
