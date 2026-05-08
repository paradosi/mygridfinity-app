import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

import { APP_NAME, RENDER_QUEUE } from "@mygridfinity/shared";
import { renderBaseplate, type RenderResult } from "./render.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 1);

export interface RenderJobData {
  modelType: "baseplate";
  params: unknown;
}

export function startRenderWorker(): { worker: Worker; connection: Redis } {
  // BullMQ requires `maxRetriesPerRequest: null` for the worker connection.
  const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<RenderJobData, RenderResult>(
    RENDER_QUEUE,
    async (job: Job<RenderJobData>) => {
      if (job.data.modelType !== "baseplate") {
        throw new Error(`unsupported modelType: ${job.data.modelType}`);
      }
      return renderBaseplate(job.data.params);
    },
    { connection, concurrency: CONCURRENCY },
  );

  worker.on("ready", () => {
    console.log(`[${APP_NAME}/worker] queue=${RENDER_QUEUE} concurrency=${CONCURRENCY} ready`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[${APP_NAME}/worker] job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job, result) => {
    console.log(
      `[${APP_NAME}/worker] job ${job.id} ok in ${result.durationMs}ms (${result.bytes} bytes) → ${result.stlPath}`,
    );
  });

  return { worker, connection };
}
