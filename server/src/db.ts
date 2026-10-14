import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { AnalysisResult, ExtractedFact, Finding, StoredDocument } from "./types.js";

export class WorkbenchDatabase {
  readonly db: Database.Database;
  constructor(filename = process.env.DATABASE_PATH || "./data/workbench.db") {
    if (filename !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    this.db = new Database(filename);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, original_name TEXT NOT NULL, type TEXT NOT NULL,
        mime_type TEXT NOT NULL, size INTEGER NOT NULL CHECK(size >= 0), text TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS analysis_sessions (
        id TEXT PRIMARY KEY, instruction TEXT NOT NULL, provider TEXT NOT NULL,
        result_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS analysis_documents (
        analysis_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        PRIMARY KEY (analysis_id, document_id)
      );
      CREATE TABLE IF NOT EXISTS extracted_facts (
        id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        field TEXT NOT NULL, value TEXT NOT NULL, normalized_value TEXT NOT NULL,
        evidence TEXT NOT NULL, confidence REAL NOT NULL, provenance TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, field TEXT NOT NULL, message TEXT NOT NULL,
        document_ids_json TEXT NOT NULL, fact_ids_json TEXT NOT NULL, provenance TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_facts_analysis ON extracted_facts(analysis_id);
      CREATE INDEX IF NOT EXISTS idx_findings_analysis ON findings(analysis_id);
    `);
  }

  addDocument(doc: StoredDocument) {
    this.db.prepare(`INSERT INTO documents (id, original_name, type, mime_type, size, text, metadata_json, created_at)
      VALUES (@id, @originalName, @type, @mimeType, @size, @text, @metadata, @createdAt)`).run({ ...doc, metadata: JSON.stringify(doc.metadata) });
  }
  listDocuments(): StoredDocument[] {
    return this.db.prepare("SELECT * FROM documents ORDER BY created_at DESC").all().map(mapDocument);
  }
  getDocuments(ids: string[]): StoredDocument[] {
    const query = this.db.prepare("SELECT * FROM documents WHERE id = ?");
    return ids.map(id => query.get(id)).filter(Boolean).map(mapDocument);
  }
  deleteDocument(id: string) { return this.db.prepare("DELETE FROM documents WHERE id = ?").run(id).changes > 0; }
  saveAnalysis(result: AnalysisResult, provider: string, documentIds: string[]) {
    const transaction = this.db.transaction(() => {
      this.db.prepare("INSERT INTO analysis_sessions VALUES (?, ?, ?, ?, ?)").run(result.id, result.instruction, provider, JSON.stringify(result), result.createdAt);
      const link = this.db.prepare("INSERT INTO analysis_documents VALUES (?, ?)");
      for (const id of documentIds) link.run(result.id, id);
      const factStmt = this.db.prepare("INSERT INTO extracted_facts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
      for (const f of result.facts) factStmt.run(f.id, result.id, f.documentId, f.field, f.value, f.normalizedValue, f.evidence, f.confidence, f.provenance);
      const findingStmt = this.db.prepare("INSERT INTO findings VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      for (const f of [...result.discrepancies, ...result.missingInformation, ...result.interpretations]) findingStmt.run(f.id, result.id, f.kind, f.field, f.message, JSON.stringify(f.documentIds), JSON.stringify(f.factIds), f.provenance);
    });
    transaction();
  }
  getAnalysis(id: string): AnalysisResult | undefined {
    const row = this.db.prepare("SELECT result_json FROM analysis_sessions WHERE id = ?").get(id) as { result_json: string } | undefined;
    return row ? JSON.parse(row.result_json) : undefined;
  }
  close() { this.db.close(); }
}

function mapDocument(row: unknown): StoredDocument {
  const r = row as Record<string, unknown>;
  return { id: String(r.id), originalName: String(r.original_name), type: r.type as StoredDocument["type"], mimeType: String(r.mime_type), size: Number(r.size), text: String(r.text), metadata: JSON.parse(String(r.metadata_json)), createdAt: String(r.created_at) };
}
