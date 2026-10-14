export type DocumentType = "pdf" | "txt" | "csv";

export interface StoredDocument {
  id: string;
  originalName: string;
  type: DocumentType;
  mimeType: string;
  size: number;
  text: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type FactKind = "company_name" | "registration_number" | "revenue" | "net_income" | "date" | "address" | "licence" | "obligation" | "person";

export interface ExtractedFact {
  id: string;
  documentId: string;
  field: FactKind;
  value: string;
  normalizedValue: string;
  evidence: string;
  sourceFilename: string;
  confidence: number;
  provenance: "source";
}

export interface Finding {
  id: string;
  kind: "discrepancy" | "missing" | "interpretation";
  field: string;
  message: string;
  documentIds: string[];
  factIds: string[];
  provenance: "derived";
}

export interface AnalysisResult {
  id: string;
  instruction: string;
  summary: { documentCount: number; factCount: number; discrepancyCount: number; missingCount: number; narrative: string };
  facts: ExtractedFact[];
  comparisons: Array<{ field: string; values: Array<{ documentId: string; filename: string; value: string; normalizedValue: string }> }>;
  discrepancies: Finding[];
  missingInformation: Finding[];
  interpretations: Finding[];
  createdAt: string;
}

export interface AnalysisProvider {
  readonly name: string;
  analyse(documents: StoredDocument[], instruction: string): Promise<AnalysisResult>;
}
