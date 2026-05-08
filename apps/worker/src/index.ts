import { APP_NAME, RENDER_QUEUE } from "@mygridfinity/shared";

// Worker entrypoint. Render-queue consumer wires up in the next step
// (V1 feature 3 in docs/HANDOFF.md). For now this just confirms the
// package boots cleanly.
function main(): void {
  // eslint-disable-next-line no-console
  console.log(`[${APP_NAME}/worker] boot — queue=${RENDER_QUEUE}`);
}

main();
