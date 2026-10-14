# Multi-Document Intelligence Workbench

A complete React and Express application for uploading PDF, TXT, and CSV documents, extracting source-grounded facts, and comparing values without collapsing document provenance into one prompt. It runs with a deterministic rules provider and requires no API key.

## Quick start (Windows PowerShell)

```powershell
git clone https://github.com/MonikaPriya98/multi-document-workbench.git
Set-Location .\multi-document-workbench
Copy-Item .env.example .env
npm install
npm run samples
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:4000`.

## Architecture

```text
React/Vite dashboard
        │ REST + multipart/form-data
Express routes → validation → PDF/TXT/CSV extraction
        │                         │
        └→ per-document facts → normalized comparison → structured findings
                                                        │
                                SQLite documents, sessions, facts, findings
```

`client/` contains the responsive React/Tailwind UI. `server/src/documents.ts` owns signature, content, and extraction checks. `server/src/analysis.ts` implements the swappable `AnalysisProvider` contract and deterministic provider. `server/src/db.ts` owns migrations and parameterized persistence. Uploaded file bytes are processed in memory and never executed; extracted text and metadata are stored independently in SQLite.

## Completed functionality

- Drag/drop or browse for up to 10 PDF, TXT, and CSV files, limited to 10 MB each.
- Server-side extension/MIME validation, PDF signature validation, binary text rejection, safe filenames, malformed/empty-file errors, and atomic multi-file preparation.
- Maintained `pdfjs-dist` PDF extraction and `csv-parse` CSV parsing.
- Independent document IDs, metadata, timestamps, text, and provenance.
- Deterministic extraction of company names, registration numbers, revenue, net income, dates, addresses, licences, obligations, and people.
- Normalized cross-document comparison, discrepancy detection, and per-document missing-field reports.
- Structured JSON persisted into normalized SQLite session, fact, and finding tables.
- Summary cards, comparison table, discrepancy/missing panels, evidence viewer, report/JSON copy actions, and responsive/loading/error/empty states.
- Typed validation with Zod, central Express error handling, restrictive CORS, and Vitest coverage of facts, provenance, discrepancies, and invalid uploads.

## API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/documents/upload` | Multipart upload under the `documents` field |
| `GET` | `/api/documents` | List document metadata |
| `DELETE` | `/api/documents/:id` | Delete a document and related analysis records |
| `POST` | `/api/analysis` | Analyse `{ documentIds, instruction }` |
| `GET` | `/api/analysis/:id` | Fetch a saved structured result |
| `GET` | `/api/health` | Service/provider health |

## Tests and production build

```powershell
npm test
npm run typecheck
npm run build
npm start --workspace server
```

## Assumptions and limitations

This interview MVP is single-user and local. The deterministic provider recognizes explicitly labelled English fields; it does not perform OCR, semantic entity resolution, arbitrary natural-language reasoning, or claim that the custom instruction changes unsupported behavior. The instruction is validated and retained for auditability. Values such as `Ltd` versus `Limited` remain distinct because silently guessing corporate-name equivalence could fabricate agreement. PDF support covers text-layer PDFs, not scanned images.

To add a real LLM, implement `AnalysisProvider`, keep per-document extraction calls separate, require evidence spans, validate model output with Zod, and pass the provider to `createApp`. Never allow a model to replace source provenance.

## Security and productionization

Before production, add authenticated tenant identities and row-level authorization; malware scanning/quarantine before parsing; reverse-proxy and per-user rate limits; CSRF protection if cookie authentication is used; stricter content sniffing; isolated extraction workers with time/memory limits; encrypted object storage and database encryption; secret-manager backed credentials; audit logs; configurable retention and verified deletion; backups; dependency/SBOM scanning; and monitoring. Serve behind TLS and apply a Content Security Policy. For larger documents, stream into quarantine rather than memory.

## AI-tool usage disclosure

The repository was scaffolded and implemented with an AI coding assistant. The runtime analysis is not generative AI: it is deterministic, inspectable TypeScript. The design intentionally labels source facts (`provenance: source`) separately from derived findings (`provenance: derived`).

## Two-minute interview demonstration

1. Start both services with `npm run dev` and explain the React/Express/SQLite separation.
2. Drag the three files from `samples/` into the upload zone and point out independent IDs and metadata.
3. Select all documents, retain the comparison instruction, and click **Analyse selected documents**.
4. Show the summary: source fact count, supported discrepancies, and missing fields.
5. Open the comparison table to highlight the revenue and registration/address inconsistencies.
6. Expand source evidence and explain that every fact links to a filename and verbatim snippet, while derived findings are visually labelled.
7. Copy JSON, mention the `AnalysisProvider` seam, and close with the security/production controls above.
