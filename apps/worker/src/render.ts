import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  type BaseplateParams,
  BaseplateParamsSchema,
  MODEL_TYPE_BASEPLATE,
  cacheKey,
  stylePlateToInt,
} from "@mygridfinity/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SCAD library is vendored at apps/worker/scad/gridfinity-rebuilt-openscad.
// Working directory must be the library root so its `include` paths resolve.
const SCAD_LIB_ROOT = path.resolve(__dirname, "..", "scad", "gridfinity-rebuilt-openscad");
const BASEPLATE_SCAD = path.join(SCAD_LIB_ROOT, "gridfinity-rebuilt-baseplate.scad");

// Local STL cache root. The worker writes finished STLs here before R2 upload.
// Configurable so the prod container can mount a tmpfs/volume.
const CACHE_ROOT =
  process.env.RENDER_CACHE_DIR ?? path.resolve(__dirname, "..", ".cache", "render");

const OPENSCAD_PATH = process.env.OPENSCAD_PATH ?? "openscad";
// Manifold backend flag is intentionally NOT set here. Production Docker
// image will pass it via OPENSCAD_BACKEND once the image is pinned. Until
// then, leave unset so we don't pass a flag the local 2021.01 doesn't know.
const OPENSCAD_BACKEND = process.env.OPENSCAD_BACKEND;

const DEFAULT_TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS ?? 60_000);

export class RenderError extends Error {
  override readonly name = "RenderError";
  readonly code: string;
  readonly stderr?: string;
  readonly exitCode?: number | null;

  constructor(
    code: string,
    message: string,
    options?: { stderr?: string; exitCode?: number | null; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.code = code;
    this.stderr = options?.stderr;
    this.exitCode = options?.exitCode;
  }
}

function paramsToCliDefines(params: BaseplateParams): string[] {
  const defines: Record<string, string> = {
    gridx: String(params.gridx),
    gridy: String(params.gridy),
    style_plate: String(stylePlateToInt(params.style_plate)),
    enable_magnet: params.enable_magnet ? "true" : "false",
    chamfer_holes: params.chamfer_holes ? "true" : "false",
    crush_ribs: params.crush_ribs ? "true" : "false",
  };
  return Object.entries(defines).flatMap(([k, v]) => ["-D", `${k}=${v}`]);
}

export interface RenderResult {
  stlPath: string;
  cacheKey: string;
  durationMs: number;
  bytes: number;
}

export async function renderBaseplate(input: unknown): Promise<RenderResult> {
  const params = BaseplateParamsSchema.parse(input);
  const key = cacheKey(MODEL_TYPE_BASEPLATE, params);
  const stlPath = path.join(CACHE_ROOT, `${key}.stl`);

  await mkdir(path.dirname(stlPath), { recursive: true });

  // Cache hit: return immediately if the STL already exists and is non-empty.
  try {
    const s = await stat(stlPath);
    if (s.isFile() && s.size > 0) {
      return { stlPath, cacheKey: key, durationMs: 0, bytes: s.size };
    }
  } catch {
    // miss — fall through to render
  }

  const args = [
    "-o",
    stlPath,
    ...(OPENSCAD_BACKEND ? [`--backend=${OPENSCAD_BACKEND}`] : []),
    ...paramsToCliDefines(params),
    BASEPLATE_SCAD,
  ];

  const start = Date.now();

  const { exitCode, stderr } = await runOpenscad(args, DEFAULT_TIMEOUT_MS);

  if (exitCode !== 0) {
    throw new RenderError(
      "openscad_failed",
      `OpenSCAD exited with code ${exitCode}`,
      { exitCode, stderr },
    );
  }

  const s = await stat(stlPath).catch(() => null);
  if (!s || !s.isFile() || s.size === 0) {
    throw new RenderError(
      "openscad_no_output",
      "OpenSCAD reported success but produced no STL",
      { stderr },
    );
  }

  return {
    stlPath,
    cacheKey: key,
    durationMs: Date.now() - start,
    bytes: s.size,
  };
}

interface OpenscadResult {
  exitCode: number | null;
  stderr: string;
}

function runOpenscad(args: string[], timeoutMs: number): Promise<OpenscadResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(OPENSCAD_PATH, args, {
      cwd: SCAD_LIB_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    // Drain stdout so the process can flush.
    child.stdout.on("data", () => {});

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new RenderError("openscad_timeout", `OpenSCAD timed out after ${timeoutMs}ms`, {
          stderr,
        }),
      );
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new RenderError("openscad_spawn_failed", `Failed to spawn ${OPENSCAD_PATH}`, {
          cause: err,
        }),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stderr });
    });
  });
}
