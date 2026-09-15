# Security Audit

This audit covers the current anonymous React, Express, Socket.IO, MongoDB, and WebRTC signaling application. It is not a claim of complete security.

## Current architecture

- Anonymous identity is generated per Socket.IO connection by the server.
- WebRTC media is peer-to-peer; the Node server relays signaling only.
- Express uses Helmet, an explicit `CLIENT_URL` origin allowlist, JSON size limits, request timeouts, API rate limiting, and generic error responses.
- Socket.IO uses bounded transport payloads, per-IP connection checks, per-event rate limits, strict room membership checks, and server-side target resolution for report/block events.
- MongoDB queries use exact string fields and Mongoose strict queries. Reports and blocks are not exposed directly to clients.

## Findings and fixes

| Severity | Finding | Fix implemented | Test approach |
|---|---|---|---|
| HIGH | Wildcard or arbitrary CORS could permit hostile sites to connect | Explicit `CLIENT_URL` allowlist; wildcard fails in production; credentials disabled | Preflight with an unapproved Origin must fail |
| HIGH | HTTP report route accepted caller-selected identities | UUID/room/reason validation, duplicate/cooldown controls, generic acknowledgement | Send object/operator values and malformed IDs; expect 400 |
| HIGH | Socket room and signaling abuse | Room membership is checked against server room state; SDP/ICE are size and shape validated | Send cross-room, oversized, and extra-field payloads |
| HIGH | Socket/event and connection flooding | Per-IP socket/connection caps, per-event buckets, queue/room caps, stale queue cleanup | Burst connections and events; expect rejection/throttling |
| MEDIUM | XSS in chat/report text | User content is rendered as React text and sanitized server-side with length caps | Submit script/tag payloads and verify no HTML execution |
| MEDIUM | Operational information leakage | Health is `{ok:true}`; stats require `x-admin-token`; production errors are generic | Request endpoints without admin token and inspect responses |
| MEDIUM | Oversized or malformed HTTP requests | Strict JSON parser, 50 KB default limit, 15 second timeout, 413/400 responses | Invalid JSON and oversized body tests |
| MEDIUM | WebRTC public IP privacy | Documented P2P behavior; TURN is required to hide peer public IPs | Verify deployment uses TURN relay when privacy is required |
| LOW | Secrets and log exposure | `.env` and `*.log` ignored; example contains placeholders; security logger avoids payloads | Secret scan and repository review |

## Controls not provided by application code

- Volumetric DDoS protection requires a CDN/WAF and provider-level limits.
- Multiple backend instances require Redis/shared state for rate limits, bans, matchmaking, and Socket.IO adapters.
- TURN infrastructure is required for reliable connectivity and IP privacy; use short-lived credentials.
- MongoDB requires TLS, least-privilege credentials, network allowlisting, backups, and monitoring.
- Abuse scoring, bot challenges, moderation review, and alerting remain operational concerns.

## Production checklist

- Set `NODE_ENV=production` and an HTTPS `CLIENT_URL`; never use `*`.
- Set a long random `ADMIN_TOKEN`; do not expose it through `VITE_*` variables.
- Set a TLS MongoDB URI with a least-privilege account.
- Terminate HTTPS/WSS at the platform or reverse proxy and configure trusted proxy headers only there.
- Deploy a WAF/CDN, TURN relay, monitoring, log redaction, backups, and alerts.
- Verify `/health` contains no counts or infrastructure details.
- Run dependency audits in CI and rotate any credential that was ever committed.

## Required environment variables

Backend: `PORT`, `CLIENT_URL`, `NODE_ENV`, `MONGODB_URI` (optional for memory fallback), `ADMIN_TOKEN` (required to use protected stats), plus the documented limit variables in `server/.env.example`.

Frontend: `VITE_SOCKET_URL`; optional `VITE_TURN_URL`, `VITE_TURN_USERNAME`, and `VITE_TURN_CREDENTIAL`. These are public browser configuration, not backend secrets.

## Validation performed

- Node syntax checks for every edited backend module.
- Validation smoke test for UUID, room ID, and SDP rules.
- `cd server; npm test` security regression suite.
- Client build should be run with `cd client; npm run build`.
- `cd server; npm audit --omit=dev` found three moderate advisories. Non-breaking `npm audit fix` made no changes; force-upgrading `uuid` is intentionally deferred because it is breaking.
- Socket/WebRTC browser verification still requires two real browsers and deployed/STUN/TURN connectivity.

## Remaining recommendations

1. Add an automated HTTP/socket integration suite and run it in CI.
2. Move rate limits, queue, rooms, bans, and Socket.IO coordination to Redis before horizontal scaling.
3. Add short-lived TURN credential issuance and a bot challenge for suspicious traffic.
4. Add authenticated moderation tooling with separate operator authorization and audit retention rules.
