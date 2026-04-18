// Azure Storage client setup and resource bootstrap for Blob, Queue, and Table services.
import { TableClient, TableEntityResult } from "@azure/data-tables";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { QueueClient, QueueServiceClient } from "@azure/storage-queue";
import { config } from "./config.js";
import type { MediaJobEntity } from "../types.js";

const usesInsecureStorageConnection = config.storageConnectionString.includes(
  "http://"
);

const blobServiceClient = BlobServiceClient.fromConnectionString(
  config.storageConnectionString
);
const blobContainerClient = blobServiceClient.getContainerClient(
  config.blobContainerName
);

const queueServiceClient = QueueServiceClient.fromConnectionString(
  config.storageConnectionString
);
const queueClient = queueServiceClient.getQueueClient(config.queueName);

const tableClient = TableClient.fromConnectionString(
  config.storageConnectionString,
  config.tableName,
  usesInsecureStorageConnection ? { allowInsecureConnection: true } : undefined
);

let initialized = false;

export async function ensureAzureResources(): Promise<void> {
  if (initialized) {
    return;
  }

  await blobContainerClient.createIfNotExists();
  await queueClient.createIfNotExists();

  try {
    await tableClient.createTable();
  } catch (error) {
    const maybeStatus = error as { statusCode?: number };
    if (maybeStatus.statusCode !== 409) {
      throw error;
    }
  }

  initialized = true;
}

export function getBlobContainerClient(): ContainerClient {
  return blobContainerClient;
}

export function getQueueClient(): QueueClient {
  return queueClient;
}

export function getTableClient(): TableClient {
  return tableClient;
}

export async function upsertMediaJob(entity: MediaJobEntity): Promise<void> {
  await tableClient.upsertEntity({
    partitionKey: entity.partitionKey,
    rowKey: entity.rowKey,
    status: entity.status,
    originalBlobName: entity.originalBlobName,
    originalFileName: entity.originalFileName,
    inputContentType: entity.inputContentType,
    derivedBlobNamesJson: entity.derivedBlobNamesJson,
    errorMessage: entity.errorMessage ?? "",
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  });
}

export async function getMediaJob(
  partitionKey: string,
  rowKey: string
): Promise<TableEntityResult<Record<string, unknown>> | null> {
  try {
    return await tableClient.getEntity(partitionKey, rowKey);
  } catch (error) {
    const maybeStatus = error as { statusCode?: number };
    if (maybeStatus.statusCode === 404) {
      return null;
    }

    throw error;
  }
}
