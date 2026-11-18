# HOKAS integration status

## Current decision

HOKAS is a viable external runtime for a user's own small bot, but NEVERLOSE ERA does not currently have a verified direct HOKAS control-plane integration.

Official HOKAS documentation describes creating a server in the HOKAS dashboard, uploading files, configuring environment variables, using the Command Builder, and starting the process. The public documentation index does not currently list a public provisioning/control API or OAuth integration.

References:
- https://hokas.net/free-hosting
- https://hokas.net/fair-use?lang=en
- https://hokas.net/terms-of-services?lang=en
- https://docs.hokas.net/quickstart
- https://docs.hokas.net/how-do-i-deploy-my-discord-bot
- https://docs.hokas.net/manage-your-server

## Policy and resource constraints

- HOKAS free plan currently advertises 0.3 vCPU, 256 MB RAM, 512 MB disk and up to 3 free servers per account.
- Free uptime uses HOKAS's own ad/link time-extension flow. NEVERLOSE ERA must not automate, proxy, incentivize manipulation of, or bypass that flow.
- HOKAS's Fair Use Policy says one Discord bot per server/container, including free and paid plans unless a plan expressly says otherwise.
- HOKAS prohibits multiple accounts, automation or account sharing to evade free-plan limits.
- HOKAS free service is "as is"; uptime is not guaranteed.
- Users should use their own HOKAS accounts and keep their bot tokens in HOKAS environment variables. NEVERLOSE ERA must not collect HOKAS passwords, session cookies, or bot tokens for this manual deployment route.

## Implemented website fallback

The NEVERLOSE ERA dashboard now includes a per-project "HOKAS Setup Guide" action. It explains how the owner can download their ZIP from NEVERLOSE ERA and manually deploy it in their own HOKAS account. This is a documented manual handoff only; it does not claim that HOKAS is directly connected.

## What is required for direct integration

Before implementing in-dashboard Start/Stop/Restart/Logs through HOKAS:

1. Ask HOKAS support whether third-party hosting dashboards and per-customer provisioning are permitted.
2. Obtain official API documentation and approved authentication (OAuth or scoped API credentials).
3. Confirm account ownership, quotas, per-server limits, and how the HOKAS ad-based uptime flow is presented to each user.
4. Confirm supported operations for create, upload/deploy, start, stop, restart, status, logs, environment variables, and deletion.
5. Design user-consented account linking without collecting HOKAS passwords, cookies, or browser session data.
6. Implement server-side authorization, per-user resource mapping, audit logs, rate limits, and safe secret handling.
7. Test with one benign Node.js bot and a user-owned HOKAS account before enabling any production controls.

Do not scrape private dashboard endpoints, reverse-engineer undocumented APIs, automate ad views/time extension, share one HOKAS account across customers, or claim direct integration until HOKAS approves and documents it.

## Current NEVERLOSE ERA execution state

The separate execution-worker scaffold remains fail-closed. Do not set `EXECUTION_ENABLED=true` or configure `EXECUTION_WORKER_URL` as a substitute for a real isolated runtime. The manual HOKAS handoff does not change the hosting API's execution capability status.
