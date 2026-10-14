import type { ErrorRequestHandler } from "express";
import multer from "multer";

export class AppError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_ERROR") {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Each file must be 10 MB or smaller." : error.code === "LIMIT_FILE_COUNT" ? "Upload at most 10 documents." : error.message;
    res.status(400).json({ error: { code: error.code, message } });
    return;
  }
  const status = error instanceof AppError ? error.status : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof Error && status < 500 ? error.message : "An unexpected server error occurred.";
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { code, message } });
};
