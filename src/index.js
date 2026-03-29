import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4004;

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
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

