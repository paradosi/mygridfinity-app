import { createHash } from "node:crypto";
import { CACHE_SCHEMA_VERSION } from "./index.js";

// Canonicalize an object so the same logical params always produce the same
// JSON string regardless of key order at construction time.
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return `{${parts.join(",")}}`;
}

export function paramsHash(params: object): string {
  const canonical = canonicalize(params);
  return createHash("sha256").update(canonical).digest("hex");
}

// Stable cache key: <modelType>/v<schemaVersion>/<sha256>
// Storage layouts (R2 prefix, local fs path) build on top of this.
export function cacheKey(modelType: string, params: object): string {
  return `${modelType}/v${CACHE_SCHEMA_VERSION}/${paramsHash(params)}`;
}
