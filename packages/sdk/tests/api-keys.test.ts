/**
 * Tests for scoped API key management methods on TalosClient.
 *
 * Covers:
 *  - listApiKeys   → GET  /api/talos/:id/api-keys
 *  - createApiKey  → POST /api/talos/:id/api-keys
 *  - revokeApiKey  → DELETE /api/talos/:id/api-keys/:keyId
 *  - regenerateKey → POST /api/talos/:id/regenerate-key
 *
 * Also includes a type-level smoke test ensuring TalosScope is a strict union
 * and that known typos are compile-time errors.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TalosClient, TalosAPIError } from "../src/client.js";
import type { TalosScope, ApiKey } from "../src/types.js";

// ── Type-level tests ────────────────────────────────────────────────────────
// These assignments would produce a TypeScript compiler error if TalosScope
// did not include the listed values, or if it accepted arbitrary strings.

// Valid scopes — must compile without @ts-expect-error.
const _validScopes: TalosScope[] = [
  "read:activity",
  "write:activity",
  "read:revenue",
  "write:revenue",
  "read:service",
  "write:service",
  "read:wallet",
  "write:approvals",
];

// Typo guard — must be rejected by the TypeScript compiler.
// @ts-expect-error "read:activities" is not a valid TalosScope
const _typoScope: TalosScope = "read:activities";

// ── Runtime tests ───────────────────────────────────────────────────────────

describe("TalosClient — Scoped API Key Management", () => {
  const BASE_URL = "http://localhost:3000";
  const client = new TalosClient({ baseUrl: BASE_URL, apiKey: "tak_test" });
  const TALOS_ID = "talos-abc123";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  // ── listApiKeys ──────────────────────────────────────────────────────────

  describe("listApiKeys", () => {
    it("calls GET /api/talos/:id/api-keys and returns the key array", async () => {
      const mockKeys: Omit<ApiKey, "keyOnce">[] = [
        {
          id: "key-1",
          talosId: TALOS_ID,
          name: "CI reporter",
          scopes: ["write:activity"],
          keyMasked: "tsk_abcd****ef12",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastUsedAt: null,
        },
      ];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockKeys,
      } as Response);

      const result = await client.listApiKeys(TALOS_ID);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/talos/${TALOS_ID}/api-keys`,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer tak_test" }),
        }),
      );
      expect(result).toEqual(mockKeys);
    });

    it("throws TalosAPIError on 401", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
        headers: { get: () => null },
      } as unknown as Response);

      await expect(client.listApiKeys(TALOS_ID)).rejects.toThrow(TalosAPIError);
    });
  });

  // ── createApiKey ─────────────────────────────────────────────────────────

  describe("createApiKey", () => {
    it("calls POST /api/talos/:id/api-keys with name and scopes", async () => {
      const params = {
        name: "CI reporter",
        scopes: ["write:activity", "read:revenue"] as TalosScope[],
      };
      const mockResponse: ApiKey = {
        id: "key-2",
        talosId: TALOS_ID,
        name: params.name,
        scopes: params.scopes,
        keyOnce: "tsk_super_secret_value",
        keyMasked: "tsk_supe****alue",
        createdAt: "2026-01-01T00:00:00.000Z",
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.createApiKey(TALOS_ID, params);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/talos/${TALOS_ID}/api-keys`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(params),
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        }),
      );
      expect(result.keyOnce).toBe("tsk_super_secret_value");
      expect(result.scopes).toContain("write:activity");
    });

    it("throws TalosAPIError on 400 (invalid scope)", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Validation failed",
        headers: { get: () => null },
      } as unknown as Response);

      await expect(
        client.createApiKey(TALOS_ID, { name: "bad", scopes: [] as unknown as TalosScope[] }),
      ).rejects.toThrow(TalosAPIError);
    });
  });

  // ── revokeApiKey ─────────────────────────────────────────────────────────

  describe("revokeApiKey", () => {
    it("calls DELETE /api/talos/:id/api-keys/:keyId", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await client.revokeApiKey(TALOS_ID, "key-1");

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/talos/${TALOS_ID}/api-keys/key-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("throws TalosAPIError on 404 (key not found)", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not found",
        headers: { get: () => null },
      } as unknown as Response);

      await expect(client.revokeApiKey(TALOS_ID, "nonexistent")).rejects.toThrow(TalosAPIError);
    });
  });

  // ── regenerateKey ─────────────────────────────────────────────────────────

  describe("regenerateKey", () => {
    const regenerateParams = {
      stellarPublicKey: "GCEX1234AAAA",
      signature: "base64sig==",
      message: `regenerate-key:${TALOS_ID}`,
    };

    it("calls POST /api/talos/:id/regenerate-key with signature payload", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ apiKey: "tlk_newkey123" }),
      } as Response);

      const result = await client.regenerateKey(TALOS_ID, regenerateParams);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/api/talos/${TALOS_ID}/regenerate-key`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(regenerateParams),
        }),
      );
      expect(result.apiKey).toBe("tlk_newkey123");
    });

    it("does NOT log the returned key material to console", async () => {
      const consoleSpy = vi.spyOn(console, "log");
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ apiKey: "tlk_sensitive_value" }),
      } as Response);

      await client.regenerateKey(TALOS_ID, regenerateParams);

      const loggedValues = consoleSpy.mock.calls.flat().map(String);
      expect(loggedValues.some((v) => v.includes("tlk_sensitive_value"))).toBe(false);
      consoleSpy.mockRestore();
    });

    it("throws TalosAPIError on 403 (invalid signature)", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "Invalid signature",
        headers: { get: () => null },
      } as unknown as Response);

      await expect(client.regenerateKey(TALOS_ID, regenerateParams)).rejects.toThrow(TalosAPIError);
    });
  });
});
