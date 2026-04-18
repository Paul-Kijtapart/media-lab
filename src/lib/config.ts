// Centralized environment/config reader so the rest of the app does not access process.env directly.
import "dotenv/config";

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return parsed;
}

export const config = {
  port: readNumber("PORT", 3000),
  storageConnectionString: readEnv("AZURE_STORAGE_CONNECTION_STRING"),
  blobContainerName: readEnv("AZURE_BLOB_CONTAINER_NAME", "media"),
  queueName: readEnv("AZURE_QUEUE_NAME", "image-jobs"),
  tableName: readEnv("AZURE_TABLE_NAME", "mediajobs"),
  redisUrl: readEnv("REDIS_URL", "redis://redis:6379"),
  workerPollIntervalMs: readNumber("WORKER_POLL_INTERVAL_MS", 3000),
  queueVisibilityTimeoutSeconds: readNumber(
    "QUEUE_VISIBILITY_TIMEOUT_SECONDS",
    120
  )
};
