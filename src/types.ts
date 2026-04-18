// Shared TypeScript contracts used across the API, worker, and storage helpers.
export type JobStatus = "queued" | "processing" | "done" | "failed";

export interface ImageJobMessage {
  jobId: string;
  originalBlobName: string;
  originalFileName: string;
  inputContentType: string;
}

export interface MediaJobEntity {
  partitionKey: string;
  rowKey: string;
  status: JobStatus;
  originalBlobName: string;
  originalFileName: string;
  inputContentType: string;
  derivedBlobNamesJson: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
