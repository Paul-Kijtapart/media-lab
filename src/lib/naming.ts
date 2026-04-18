// Naming helpers for Blob Storage paths so upload/output conventions stay consistent in one place.
import path from "node:path";

function normalizeExtension(fileName: string): string {
  return path.extname(fileName).replace(".", "").toLowerCase() || "bin";
}

export function getOriginalBlobName(jobId: string, originalFileName: string): string {
  const extension = normalizeExtension(originalFileName);
  return `originals/${jobId}/source.${extension}`;
}

export function getDerivedBlobNames(jobId: string): string[] {
  return [
    `derived/${jobId}/image-1200.webp`,
    `derived/${jobId}/image-thumb.webp`
  ];
}
