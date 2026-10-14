import type { AnalysisResult, DocumentItem } from "./types";
async function request<T>(url: string, options?: RequestInit): Promise<T> { const response = await fetch(url, options); if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error?.message || `Request failed (${response.status})`); } return response.status === 204 ? undefined as T : response.json(); }
export const api = {
  list: () => request<{documents: DocumentItem[]}>("/api/documents"),
  upload: (files: File[]) => { const body = new FormData(); files.forEach(file => body.append("documents", file)); return request<{documents: DocumentItem[]}>("/api/documents/upload", { method: "POST", body }); },
  remove: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),
  analyse: (documentIds: string[], instruction: string) => request<AnalysisResult>("/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentIds, instruction }) })
};
