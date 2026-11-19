import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  formatGeminiErrorResponse,
  generateBlueprintService,
  regenerateSlideService,
  type GenerateRequestBody,
  type RegenerateSlideRequestBody,
} from "./api/_lib/geminiBlueprint.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

// Health check endpoint for Cloud Run container probes
app.get("/healthz", (_req, res) => {
  res.status(200).send("OK");
});

app.post("/api/generate-blueprint", async (req, res) => {
  try {
    const result = await generateBlueprintService(req.body as GenerateRequestBody);
    res.json(result);
  } catch (err: unknown) {
    const { status, body } = formatGeminiErrorResponse(err);
    res.status(status).json(body);
  }
});

app.post("/api/regenerate-slide", async (req, res) => {
  try {
    const result = await regenerateSlideService(
      req.body as RegenerateSlideRequestBody
    );
    res.json(result);
  } catch (err: unknown) {
    const { status, body } = formatGeminiErrorResponse(err);
    res.status(status).json(body);
  }
});

async function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const distDir = path.resolve(__dirname, "dist");
  const hasDist = fs.existsSync(distDir);
  const isProd = process.env.NODE_ENV === "production" || hasDist;

  if (isProd && hasDist) {
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`BWS Carousel Engine server running on http://0.0.0.0:${port}`);
  });
}

startServer();
