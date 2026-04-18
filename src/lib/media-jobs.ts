// Main media workflow orchestration: create jobs, process images, and update storage/state.
import sharp from "sharp";
import { ulid } from "ulid";
import { ensureAzureResources, getBlobContainerClient, getMediaJob, getQueueClient, upsertMediaJob } from "./azure.js";
import { getDerivedBlobNames, getOriginalBlobName } from "./naming.js";
import { getDerivedBlobNames as getDerivedBlobNamesFromRedis, getJobStatus, setDerivedBlobNames, setJobStatus } from "./redis.js";
import type { ImageJobMessage, JobStatus, MediaJobEntity } from "../types.js";

const PARTITION_KEY = "media";

function nowIso(): string {
  return new Date().toISOString();
}

function buildEntity(message: ImageJobMessage, status: JobStatus): MediaJobEntity {
  const now = nowIso();

  return {
    partitionKey: PARTITION_KEY,
    rowKey: message.jobId,
    status,
    originalBlobName: message.originalBlobName,
    originalFileName: message.originalFileName,
    inputContentType: message.inputContentType,
    derivedBlobNamesJson: JSON.stringify(getDerivedBlobNames(message.jobId)),
    createdAt: now,
    updatedAt: now
  };
}

export async function createImageJob(file: Express.Multer.File): Promise<{
  jobId: string;
  originalBlobName: string;
}> {
  await ensureAzureResources();

  const jobId = ulid();
  const originalBlobName = getOriginalBlobName(jobId, file.originalname);
  const blobClient = getBlobContainerClient().getBlockBlobClient(originalBlobName);

  await blobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype
    },
    metadata: {
      originalFileName: file.originalname
    }
  });

  const message: ImageJobMessage = {
    jobId,
    originalBlobName,
    originalFileName: file.originalname,
    inputContentType: file.mimetype
  };

  await getQueueClient().sendMessage(Buffer.from(JSON.stringify(message)).toString("base64"));
  await setJobStatus(jobId, "queued");
  await upsertMediaJob(buildEntity(message, "queued"));

  return {
    jobId,
    originalBlobName
  };
}

export async function getJobDetails(jobId: string): Promise<{
  jobId: string;
  status: JobStatus | null;
  tableRecord: Record<string, unknown> | null;
  derivedBlobNames: string[];
}> {
  await ensureAzureResources();

  const [status, tableRecord, derivedBlobNames] = await Promise.all([
    getJobStatus(jobId),
    getMediaJob(PARTITION_KEY, jobId),
    getDerivedBlobNamesFromRedis(jobId)
  ]);

  return {
    jobId,
    status,
    tableRecord,
    derivedBlobNames
  };
}

export async function processImageJobMessage(message: ImageJobMessage): Promise<string[]> {
  await ensureAzureResources();

  const originalBlobClient = getBlobContainerClient().getBlockBlobClient(message.originalBlobName);
  const download = await originalBlobClient.download();
  const sourceBuffer = await streamToBuffer(download.readableStreamBody);

  const derivedBlobNames = getDerivedBlobNames(message.jobId);

  const optimizedLarge = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const optimizedThumb = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: 320, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  const uploads = [
    getBlobContainerClient().getBlockBlobClient(derivedBlobNames[0]).uploadData(optimizedLarge, {
      blobHTTPHeaders: { blobContentType: "image/webp" }
    }),
    getBlobContainerClient().getBlockBlobClient(derivedBlobNames[1]).uploadData(optimizedThumb, {
      blobHTTPHeaders: { blobContentType: "image/webp" }
    })
  ];

  await Promise.all(uploads);
  await setJobStatus(message.jobId, "done");
  await setDerivedBlobNames(message.jobId, derivedBlobNames);

  const existing = await getMediaJob(PARTITION_KEY, message.jobId);
  await upsertMediaJob({
    partitionKey: PARTITION_KEY,
    rowKey: message.jobId,
    status: "done",
    originalBlobName: message.originalBlobName,
    originalFileName: message.originalFileName,
    inputContentType: message.inputContentType,
    derivedBlobNamesJson: JSON.stringify(derivedBlobNames),
    errorMessage: "",
    createdAt: getExistingCreatedAt(existing),
    updatedAt: nowIso()
  });

  return derivedBlobNames;
}

export async function markImageJobFailed(
  message: ImageJobMessage,
  errorMessage: string
): Promise<void> {
  await setJobStatus(message.jobId, "failed");

  const existing = await getMediaJob(PARTITION_KEY, message.jobId);
  await upsertMediaJob({
    partitionKey: PARTITION_KEY,
    rowKey: message.jobId,
    status: "failed",
    originalBlobName: message.originalBlobName,
    originalFileName: message.originalFileName,
    inputContentType: message.inputContentType,
    derivedBlobNamesJson: JSON.stringify(getDerivedBlobNames(message.jobId)),
    errorMessage,
    createdAt: getExistingCreatedAt(existing),
    updatedAt: nowIso()
  });
}

function getExistingCreatedAt(existing: Record<string, unknown> | null): string {
  if (existing && typeof existing.createdAt === "string") {
    return existing.createdAt;
  }

  return nowIso();
}

async function streamToBuffer(
  stream: NodeJS.ReadableStream | undefined
): Promise<Buffer> {
  if (!stream) {
    throw new Error("Blob download stream was empty");
  }

  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
