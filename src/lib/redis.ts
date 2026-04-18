// Redis helper layer for fast-changing workflow state like job status and derived blob names.
import { createClient } from "redis";
import { config } from "./config.js";
import type { JobStatus } from "../types.js";

const client = createClient({
  url: config.redisUrl
});

let connected = false;

async function ensureConnected(): Promise<void> {
  if (connected) {
    return;
  }

  client.on("error", (error) => {
    console.error("Redis client error", error);
  });

  await client.connect();
  connected = true;
}

export async function setJobStatus(jobId: string, status: JobStatus): Promise<void> {
  await ensureConnected();
  await client.set(`job:${jobId}:status`, status);
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  await ensureConnected();
  const value = await client.get(`job:${jobId}:status`);
  if (!value) {
    return null;
  }

  return value as JobStatus;
}

export async function setDerivedBlobNames(jobId: string, blobNames: string[]): Promise<void> {
  await ensureConnected();
  await client.set(`job:${jobId}:derivedBlobs`, JSON.stringify(blobNames));
}

export async function getDerivedBlobNames(jobId: string): Promise<string[]> {
  await ensureConnected();
  const value = await client.get(`job:${jobId}:derivedBlobs`);
  if (!value) {
    return [];
  }

  return JSON.parse(value) as string[];
}
