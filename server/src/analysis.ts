import { randomUUID } from "node:crypto";
import type { AnalysisProvider, AnalysisResult, ExtractedFact, FactKind, Finding, StoredDocument } from "./types.js";

type Rule = { field: FactKind; pattern: RegExp; normalize?: (value: string) => string };
const money = (value: string) => String(Number(value.replace(/[$,\s]/g, "")));
const plain = (value: string) => value.trim().toLowerCase().replace(/[.,]$/, "").replace(/\s+/g, " ");
const rules: Rule[] = [
  { field: "company_name", pattern: /(?:company(?: name)?|legal name|entity)\s*[:|,-]\s*([^\n|]+)/gi, normalize: plain },
  { field: "registration_number", pattern: /(?:registration(?: number| no\.?)?|company number)\s*[:|,-]\s*([A-Z0-9-]+)/gi, normalize: plain },
  { field: "revenue", pattern: /(?:annual )?revenue\s*[:|,-]\s*(\$?\s?[\d,.]+)/gi, normalize: money },
  { field: "net_income", pattern: /net (?:income|profit)\s*[:|,-]\s*(\$?\s?[\d,.]+)/gi, normalize: money },
  { field: "date", pattern: /(?:reporting date|application date|effective date|date)\s*[:|,-]\s*([A-Za-z0-9, /-]+)/gi, normalize: plain },
  { field: "address", pattern: /(?:registered )?address\s*[:|,-]\s*([^\n|]+)/gi, normalize: plain },
  { field: "licence", pattern: /(?:licen[cs]e(?: number| no\.?)?)\s*[:|,-]\s*([A-Z0-9-]+)/gi, normalize: plain },
  { field: "obligation", pattern: /(?:obligation|must|required to)\s*[:|,-]?\s*([^\n|.]+(?:\.)?)/gi, normalize: plain },
  { field: "person", pattern: /(?:director|applicant|contact(?: name)?)\s*[:|,-]\s*([^\n|]+)/gi, normalize: plain }
];
const expected: FactKind[] = ["company_name", "registration_number", "revenue", "net_income", "date", "address", "licence"];

export function extractFacts(document: StoredDocument): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of document.text.matchAll(rule.pattern)) {
      const value = match[1]?.trim();
      if (!value) continue;
      const start = Math.max(0, match.index - 35);
      const evidence = document.text.slice(start, Math.min(document.text.length, match.index + match[0].length + 35)).replace(/\n/g, " ");
      facts.push({ id: randomUUID(), documentId: document.id, field: rule.field, value, normalizedValue: (rule.normalize || plain)(value), evidence, sourceFilename: document.originalName, confidence: 1, provenance: "source" });
    }
  }
  return facts;
}

export function findDiscrepancies(facts: ExtractedFact[]): Finding[] {
  const findings: Finding[] = [];
  for (const field of expected) {
    const fieldFacts = facts.filter(f => f.field === field);
    const values = new Set(fieldFacts.map(f => f.normalizedValue));
    const docs = new Set(fieldFacts.map(f => f.documentId));
    if (values.size > 1 && docs.size > 1) findings.push({ id: randomUUID(), kind: "discrepancy", field, message: `Conflicting ${field.replaceAll("_", " ")} values: ${[...new Set(fieldFacts.map(f => f.value))].join(" vs ")}.`, documentIds: [...docs], factIds: fieldFacts.map(f => f.id), provenance: "derived" });
  }
  return findings;
}

export class DeterministicAnalysisProvider implements AnalysisProvider {
  readonly name = "deterministic-mock-v1";
  async analyse(documents: StoredDocument[], instruction: string): Promise<AnalysisResult> {
    const facts = documents.flatMap(extractFacts);
    const discrepancies = findDiscrepancies(facts);
    const missingInformation: Finding[] = [];
    for (const document of documents) for (const field of expected) {
      if (!facts.some(f => f.documentId === document.id && f.field === field)) missingInformation.push({ id: randomUUID(), kind: "missing", field, message: `${field.replaceAll("_", " ")} was not found in ${document.originalName}.`, documentIds: [document.id], factIds: [], provenance: "derived" });
    }
    const comparisons = expected.map(field => ({ field, values: facts.filter(f => f.field === field).map(f => ({ documentId: f.documentId, filename: f.sourceFilename, value: f.value, normalizedValue: f.normalizedValue })) })).filter(group => group.values.length);
    const interpretations: Finding[] = [{ id: randomUUID(), kind: "interpretation", field: "scope", message: `Deterministic rules evaluated ${documents.length} document(s). The custom instruction is recorded for auditability; unsupported free-form reasoning is not fabricated.`, documentIds: documents.map(d => d.id), factIds: [], provenance: "derived" }];
    const createdAt = new Date().toISOString();
    return { id: randomUUID(), instruction, summary: { documentCount: documents.length, factCount: facts.length, discrepancyCount: discrepancies.length, missingCount: missingInformation.length, narrative: `Found ${facts.length} source-backed facts and ${discrepancies.length} cross-document discrepancies across ${documents.length} documents.` }, facts, comparisons, discrepancies, missingInformation, interpretations, createdAt };
  }
}
