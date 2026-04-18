// Background worker entry point: polls the queue, processes image jobs, and updates job state.
import { ensureAzureResources, getQueueClient } from "../lib/azure.js";
import { config } from "../lib/config.js";
import { markImageJobFailed, processImageJobMessage } from "../lib/media-jobs.js";
import { setJobStatus } from "../lib/redis.js";
import type { ImageJobMessage } from "../types.js";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function processNextMessage(): Promise<void> {
  const queueClient = getQueueClient();
  const response = await queueClient.receiveMessages({
    numberOfMessages: 1,
    visibilityTimeout: config.queueVisibilityTimeoutSeconds
  });

  const queueMessage = response.receivedMessageItems[0];

  if (!queueMessage) {
    await sleep(config.workerPollIntervalMs);
    return;
  }

  const message = JSON.parse(
    Buffer.from(queueMessage.messageText, "base64").toString("utf8")
  ) as ImageJobMessage;

  console.log("image-worker picked up job", message.jobId);
  await setJobStatus(message.jobId, "processing");

  try {
    const blobNames = await processImageJobMessage(message);
    await queueClient.deleteMessage(queueMessage.messageId, queueMessage.popReceipt);
    console.log("image-worker finished job", message.jobId, blobNames);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown image worker error";
    console.error("image-worker failed job", message.jobId, error);
    await markImageJobFailed(message, errorMessage);
  }
}

async function main(): Promise<void> {
  await ensureAzureResources();

  console.log("image-worker started");

  while (true) {
    await processNextMessage();
  }
}

main().catch((error) => {
  console.error("image-worker crashed on startup", error);
  process.exit(1);
});
