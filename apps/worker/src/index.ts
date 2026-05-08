import { APP_NAME } from "@mygridfinity/shared";
import { startRenderWorker } from "./queue.js";

const { worker, connection } = startRenderWorker();

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`[${APP_NAME}/worker] received ${signal}, draining...`);
  try {
    await worker.close();
    await connection.quit();
  } catch (err) {
    console.error(`[${APP_NAME}/worker] shutdown error:`, err);
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
