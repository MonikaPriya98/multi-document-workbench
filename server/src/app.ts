import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { WorkbenchDatabase } from "./db.js";
import { AppError, errorHandler } from "./errors.js";
import { extractText, validateUpload } from "./documents.js";
import { DeterministicAnalysisProvider } from "./analysis.js";
import type { AnalysisProvider, StoredDocument } from "./types.js";

const analysisSchema = z.object({ documentIds: z.array(z.string().uuid()).min(1).max(10), instruction: z.string().trim().min(3).max(2000) });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 0 } });

export function createApp(db = new WorkbenchDatabase(), provider: AnalysisProvider = new DeterministicAnalysisProvider()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", methods: ["GET", "POST", "DELETE"] }));
  app.use(express.json({ limit: "50kb" }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok", provider: provider.name, timestamp: new Date().toISOString() }));

  app.post("/api/documents/upload", upload.array("documents", 10), async (req, res, next) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files?.length) throw new AppError(400, "Choose at least one document.", "NO_FILES");
      const prepared = await Promise.all(files.map(async file => {
        const type = validateUpload(file);
        const extracted = await extractText(file, type);
        return { id: randomUUID(), originalName: file.originalname, type, mimeType: file.mimetype, size: file.size, text: extracted.text, metadata: extracted.metadata, createdAt: new Date().toISOString() } satisfies StoredDocument;
      }));
      for (const doc of prepared) db.addDocument(doc);
      res.status(201).json({ documents: prepared.map(publicDocument) });
    } catch (error) { next(error); }
  });
  app.get("/api/documents", (_req, res) => res.json({ documents: db.listDocuments().map(publicDocument) }));
  app.delete("/api/documents/:id", (req, res, next) => {
    try { if (!db.deleteDocument(req.params.id)) throw new AppError(404, "Document not found.", "NOT_FOUND"); res.status(204).send(); } catch (error) { next(error); }
  });
  app.post("/api/analysis", async (req, res, next) => {
    try {
      const parsed = analysisSchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message || "Invalid analysis request.", "VALIDATION_ERROR");
      const documents = db.getDocuments(parsed.data.documentIds);
      if (documents.length !== new Set(parsed.data.documentIds).size) throw new AppError(404, "One or more documents were not found.", "NOT_FOUND");
      const result = await provider.analyse(documents, parsed.data.instruction);
      db.saveAnalysis(result, provider.name, parsed.data.documentIds);
      res.status(201).json(result);
    } catch (error) { next(error); }
  });
  app.get("/api/analysis/:id", (req, res, next) => {
    try { const result = db.getAnalysis(req.params.id); if (!result) throw new AppError(404, "Analysis not found.", "NOT_FOUND"); res.json(result); } catch (error) { next(error); }
  });
  app.use((_req, _res, next) => next(new AppError(404, "Route not found.", "NOT_FOUND")));
  app.use(errorHandler);
  return app;
}

function publicDocument({ text: _text, ...doc }: StoredDocument) { return { ...doc, textLength: _text.length }; }
