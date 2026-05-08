// Smoke test: render the smallest possible baseplate end-to-end via the
// real OpenSCAD CLI, no queue. Run with:
//
//   pnpm --filter @mygridfinity/worker exec tsx src/scripts/smoke.ts
//
// Verifies the SCAD library is reachable, OpenSCAD is on PATH, and the
// parameter-to-CLI translation produces a non-empty STL.

import { renderBaseplate } from "../render.js";

async function main(): Promise<void> {
  const result = await renderBaseplate({
    gridx: 1,
    gridy: 1,
    style_plate: "thin",
    enable_magnet: false,
    chamfer_holes: false,
    crush_ribs: false,
  });

  console.log("smoke OK");
  console.log(`  cacheKey:   ${result.cacheKey}`);
  console.log(`  stlPath:    ${result.stlPath}`);
  console.log(`  bytes:      ${result.bytes}`);
  console.log(`  durationMs: ${result.durationMs}`);
}

main().catch((err) => {
  console.error("smoke FAILED");
  console.error(err);
  process.exit(1);
});
