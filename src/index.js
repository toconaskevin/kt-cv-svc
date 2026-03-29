import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4004;

// AWS SDK v3 requires a region for SigV4 even with MinIO; not used for routing to a custom endpoint.
const s3Region = process.env.S3_REGION?.trim() || "us-east-1";

/**
 * Docker Compose uses hostname `minio`. Cloud Run multi-container has no Docker DNS — sidecars use
 * localhost. If S3_ENDPOINT is still `http://minio:9000`, DNS fails with ENOTFOUND.
 */
function resolveS3Endpoint() {
  const raw = process.env.S3_ENDPOINT?.trim();
  if (!raw) return "http://127.0.0.1:9000";
  if (!process.env.K_SERVICE) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname === "minio") {
      u.hostname = "127.0.0.1";
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return raw;
}

const s3 = new S3Client({
  region: s3Region,
  endpoint: resolveS3Endpoint(),
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

const bucket = process.env.S3_BUCKET || "cv-bucket";
const key = process.env.S3_KEY || "cv.pdf";

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "cv-service" });
});

app.get("/cv", async (_req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const data = await s3.send(command);
    res.setHeader("Content-Type", data.ContentType || "application/pdf");
    if (data.Body) {
      data.Body.pipe(res);
    } else {
      res.status(500).json({ error: "No data in object body" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch CV from object store" });
  }
});

app.listen(port, () => {
  console.log(`cv-service listening on port ${port}`);
});

