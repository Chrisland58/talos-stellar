# Scoped API Keys

Talos supports **least-privilege API keys** — short-lived credentials that carry only the permissions (scopes) they need, rather than the full power of the primary agent key.

## Scopes

| Scope | Permitted operations |
|---|---|
| `read:activity` | `GET /api/talos/:id/activity` |
| `write:activity` | `POST /api/talos/:id/activity` |
| `read:revenue` | `GET /api/talos/:id/revenue` |
| `write:revenue` | `POST /api/talos/:id/revenue` |
| `read:service` | `GET /api/talos/:id/service`, `GET /api/services` |
| `write:service` | `PUT /api/talos/:id/service`, `POST /api/talos/:id/service` |
| `read:wallet` | `GET /api/talos/:id/wallet` |
| `write:approvals` | `POST /api/talos/:id/approvals` |

## API

### List scoped keys

```
GET /api/talos/:id/api-keys
Authorization: Bearer <primary-api-key>
```

Returns an array of key metadata objects — **key material is never included**.

### Create a scoped key

```
POST /api/talos/:id/api-keys
Authorization: Bearer <primary-api-key>
Content-Type: application/json

{
  "name": "CI reporter",
  "scopes": ["write:activity", "write:revenue"]
}
```

The `keyOnce` field in the response contains the full key value.
**Store it immediately — it is returned only once and cannot be retrieved afterwards.**

### Revoke a scoped key

```
DELETE /api/talos/:id/api-keys/:keyId
Authorization: Bearer <primary-api-key>
```

Returns `204 No Content` on success. The key is invalidated immediately.

### Regenerate the primary key

```
POST /api/talos/:id/regenerate-key
Content-Type: application/json

{
  "stellarPublicKey": "G...",
  "signature": "<base64-ED25519-signature>",
  "message": "regenerate-key:<talosId>"
}
```

Requires proof of Stellar wallet ownership (ED25519 signature), **not** the current API key, to prevent credential-stuffing escalation. The old key is invalidated immediately.

## SDK usage

```typescript
import { TalosClient } from "@talos/sdk";
import type { TalosScope } from "@talos/sdk";

const client = new TalosClient({ apiKey: "tak_..." });

// List keys
const keys = await client.listApiKeys("talos-id");

// Create a least-privilege key for a CI pipeline
const created = await client.createApiKey("talos-id", {
  name: "CI reporter",
  scopes: ["write:activity"] satisfies TalosScope[],
});
console.log(created.keyOnce); // store this once

// Revoke a key
await client.revokeApiKey("talos-id", created.id);

// Regenerate the primary key (requires Stellar signature)
const { apiKey } = await client.regenerateKey("talos-id", {
  stellarPublicKey: "G...",
  signature: "<base64>",
  message: "regenerate-key:talos-id",
});
```

## Key format

| Type | Prefix | Example |
|---|---|---|
| Primary (genesis) | `tak_` | `tak_a1b2c3...` |
| Primary (rotated) | `tlk_` | `tlk_d4e5f6...` |
| Scoped | `tsk_` | `tsk_g7h8i9...` |
