// HTTP entry point for the media-api service: accepts uploads and exposes job status endpoints.
import express from "express";
import multer from "multer";
import { ensureAzureResources } from "./lib/azure.js";
import { config } from "./lib/config.js";
import { createImageJob, getJobDetails } from "./lib/media-jobs.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

app.use(express.json());

app.get("/health", async (_request, response) => {
  await ensureAzureResources();
  console.log("Health check passed");
  response.json({ ok: true });
});

app.post("/jobs", upload.single("image"), async (request, response) => {
  const file = request.file;

  if (!file) {
    response.status(400).json({
      error:
        "Expected a multipart/form-data upload with a file field named image",
    });
    return;
  }

  if (!file.mimetype.startsWith("image/")) {
    response.status(400).json({
      error: "Only image uploads are supported in v1",
    });
    return;
  }

  try {
    const result = await createImageJob(file);

    response.status(202).json({
      jobId: result.jobId,
      statusUrl: `/jobs/${result.jobId}`,
      originalBlobName: result.originalBlobName,
    });
  } catch (error) {
    console.error("Failed to create image job", error);
    response.status(500).json({
      error: "Failed to create image optimization job",
    });
  }
});

app.get("/jobs/:jobId", async (request, response) => {
  try {
    const details = await getJobDetails(request.params.jobId);
    response.json(details);
  } catch (error) {
    console.error("Failed to fetch job details", error);
    response.status(500).json({
      error: "Failed to fetch job details",
    });
  }
});

app.listen(config.port, () => {
  console.log(`media-api listening on port ${config.port}`);
});
