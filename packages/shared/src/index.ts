export const APP_NAME = "mygridfinity.app";

// BullMQ queue names. Stable strings — changing them invalidates in-flight jobs.
export const RENDER_QUEUE = "render";

// Cache schema version. Bump when the parameter-to-STL contract changes,
// to cleanly invalidate R2-cached STLs without manual purge.
export const CACHE_SCHEMA_VERSION = 1;

export * from "./schemas/baseplate.js";
export * from "./cache-key.js";
