import { describe, expect, it } from "vitest";
import { extractFacts, findDiscrepancies } from "../src/analysis.js";
import type { StoredDocument } from "../src/types.js";

const doc = (id: string, name: string, text: string): StoredDocument => ({ id, originalName: name, type: "txt", mimeType: "text/plain", size: text.length, text, metadata: {}, createdAt: "2026-01-01T00:00:00.000Z" });
describe("structured analysis", () => {
  it("extracts facts with document provenance", () => {
    const facts = extractFacts(doc("one", "application.txt", "Company Name: Northstar Ltd\nRevenue: $2,450,000"));
    expect(facts).toEqual(expect.arrayContaining([expect.objectContaining({ documentId: "one", sourceFilename: "application.txt", field: "company_name", provenance: "source" }), expect.objectContaining({ field: "revenue", normalizedValue: "2450000" })]));
  });
  it("detects only cross-document discrepancies", () => {
    const facts = [doc("one", "one.txt", "Registration Number: ABC-1"), doc("two", "two.txt", "Registration Number: ABC-2")].flatMap(extractFacts);
    expect(findDiscrepancies(facts)).toEqual([expect.objectContaining({ field: "registration_number", kind: "discrepancy", provenance: "derived" })]);
  });
});
