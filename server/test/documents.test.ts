import { describe, expect, it } from "vitest";
import { validateUpload } from "../src/documents.js";
describe("upload validation", () => {
  it("rejects an executable renamed as text", () => {
    expect(() => validateUpload({ originalname: "payload.exe", mimetype: "application/octet-stream", size: 2, buffer: Buffer.from("MZ") })).toThrow(/Unsupported file/);
  });
  it("rejects a PDF without its signature", () => {
    expect(() => validateUpload({ originalname: "fake.pdf", mimetype: "application/pdf", size: 5, buffer: Buffer.from("hello") })).toThrow(/valid PDF signature/);
  });
});
