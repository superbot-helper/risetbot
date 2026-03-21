/**
 * API service layer — typed hooks using @tanstack/react-query.
 * Includes:
 * - JSON fetch helpers
 * - multipart upload helpers
 * - per-file upload progress helper for knowledge PDFs
 * - report polling for active pipelines
 * - knowledge detail hook for review/checkpoint UI
 */
import { useMutation, useQuery } from "@tanstack/react-query";

const API_BASE = "/api";

type QueryKey = readonly unknown[];

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  detail?: string;
}

export interface KnowledgeItem {
  id: string;
  projectId: string;
  schemaId: string | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  status: string;
  extractedData?: {
    rows?: Record<string, unknown>[];
    rawText?: string;
    confidence?: number;
    pageCount?: number;
    schemaId?: string | null;
  } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaColumn {
  name: string;
  type: "text" | "number" | "date" | "category" | "boolean";
  aiGuidance: string;
  required?: boolean;
}

export interface SchemaItem {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  columns: SchemaColumn[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateItem {
  id: string;
  projectId: string;
  name: string;
  filePath: string;
  fileName: string;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportPipelineStep {
  key: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

export interface ReportPipeline {
  currentStep: number;
  totalSteps: number;
  currentLabel: string;
  error?: string;
  steps: ReportPipelineStep[];
}

export interface ReportItem {
  id: string;
  projectId: string;
  templateId: string | null;
  name: string;
  filePath: string;
  sourceIds: string[];
  status: string;
  progress: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  analysisData?: {
    status?: string;
    pipeline?: ReportPipeline;
    reportType?: string;
    reportPath?: string;
    reportContent?: string;
    verifiedFacts?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
}

export interface TemplateUploadResponse extends TemplateItem {}

export interface KnowledgeUploadResponse {
  files: KnowledgeItem[];
}

/**
 * Generic JSON fetch wrapper with error handling.
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers ?? {});

  if (
    !headers.has("Content-Type") &&
    options?.body &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMessage = res.statusText || "API request failed";
    try {
      const error = (await res.json()) as ApiErrorPayload;
      errorMessage =
        error.error || error.message || error.detail || errorMessage;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errorMessage);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/**
 * Multipart upload wrapper (browser sets boundary).
 */
async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errorMessage = res.statusText || "Upload failed";
    try {
      const error = (await res.json()) as ApiErrorPayload;
      errorMessage =
        error.error || error.message || error.detail || errorMessage;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errorMessage);
  }

  return (await res.json()) as T;
}

/**
 * XHR upload helper to support per-file progress updates.
 */
function xhrUpload<T>(
  url: string,
  formData: FormData,
  onProgress?: (progress: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", `${API_BASE}${url}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress?.(Math.min(100, Math.max(0, progress)));
    };

    xhr.onerror = () => {
      reject(new Error("Network error during upload"));
    };

    xhr.onload = () => {
      try {
        const rawText = xhr.responseText || "";
        const json = rawText
          ? (JSON.parse(rawText) as T | ApiErrorPayload)
          : undefined;

        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(json as T);
          return;
        }

        const message =
          (json as ApiErrorPayload | undefined)?.error ||
          (json as ApiErrorPayload | undefined)?.message ||
          (json as ApiErrorPayload | undefined)?.detail ||
          xhr.statusText ||
          "Upload failed";

        reject(new Error(message));
      } catch {
        reject(new Error(xhr.statusText || "Upload failed"));
      }
    };

    xhr.send(formData);
  });
}

function hasActiveReportPipeline(reports: ReportItem[] | undefined): boolean {
  if (!reports || reports.length === 0) return false;

  return reports.some((report) => !["done", "error"].includes(report.status));
}

function reportPollingInterval(data: ReportItem[] | undefined): number | false {
  return hasActiveReportPipeline(data) ? 3000 : false;
}

// ─── Dashboard ──────────────────────────────────────────────
export function useGetDashboardStats() {
  return useQuery({
    queryKey: ["/api/dashboard/stats"] as QueryKey,
    queryFn: () => apiFetch<any>("/dashboard/stats"),
  });
}

export function useGetRecentActivity() {
  return useQuery({
    queryKey: ["/api/dashboard/activity"] as QueryKey,
    queryFn: () => apiFetch<any[]>("/dashboard/activity"),
  });
}

export function useGetProjectStatusTable() {
  return useQuery({
    queryKey: ["/api/dashboard/project-status"] as QueryKey,
    queryFn: () => apiFetch<any[]>("/dashboard/project-status"),
  });
}

// ─── Projects ───────────────────────────────────────────────
export function useListProjects() {
  return useQuery({
    queryKey: ["/api/projects"] as QueryKey,
    queryFn: () => apiFetch<any[]>("/projects"),
  });
}

export function useGetProject(id: string) {
  return useQuery({
    queryKey: ["/api/projects", id] as QueryKey,
    queryFn: () => apiFetch<any>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  return useMutation({
    mutationFn: ({ data }: { data: { name: string; description?: string } }) =>
      apiFetch<any>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiFetch<any>(`/projects/${id}`, { method: "DELETE" }),
  });
}

// ─── Knowledge ──────────────────────────────────────────────
export function useListKnowledge(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/knowledge`] as QueryKey,
    queryFn: () =>
      apiFetch<KnowledgeItem[]>(`/projects/${projectId}/knowledge`),
    enabled: !!projectId,
  });
}

export function useGetKnowledge(projectId: string, id: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/knowledge`, id] as QueryKey,
    queryFn: () =>
      apiFetch<KnowledgeItem>(`/projects/${projectId}/knowledge/${id}`),
    enabled: !!projectId && !!id,
  });
}

/**
 * Upload PDF files via multipart FormData.
 * Supports batch upload without granular progress.
 */
export function useUploadKnowledge() {
  return useMutation({
    mutationFn: ({
      projectId,
      files,
      schemaId,
    }: {
      projectId: string;
      files: File[];
      schemaId?: string;
    }) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      if (schemaId) formData.append("schemaId", schemaId);

      return apiUpload<KnowledgeUploadResponse>(
        `/projects/${projectId}/knowledge`,
        formData,
      );
    },
  });
}

/**
 * Upload a single knowledge PDF with granular progress callback.
 * Useful for Phase 7 per-file upload progress UI.
 */
export async function uploadKnowledgeFileWithProgress(params: {
  projectId: string;
  file: File;
  schemaId?: string;
  onProgress?: (progress: number) => void;
}): Promise<KnowledgeUploadResponse> {
  const formData = new FormData();
  formData.append("files", params.file);
  if (params.schemaId) formData.append("schemaId", params.schemaId);

  return xhrUpload<KnowledgeUploadResponse>(
    `/projects/${params.projectId}/knowledge`,
    formData,
    params.onProgress,
  );
}

/**
 * Sequential multi-file helper that preserves per-file progress reporting.
 */
export async function uploadKnowledgeFilesWithProgress(params: {
  projectId: string;
  files: File[];
  schemaId?: string;
  onFileProgress?: (file: File, progress: number, index: number) => void;
}): Promise<KnowledgeUploadResponse> {
  const uploaded: KnowledgeItem[] = [];

  for (let index = 0; index < params.files.length; index += 1) {
    const file = params.files[index];
    const result = await uploadKnowledgeFileWithProgress({
      projectId: params.projectId,
      file,
      schemaId: params.schemaId,
      onProgress: (progress) => params.onFileProgress?.(file, progress, index),
    });

    if (Array.isArray(result.files)) {
      uploaded.push(...result.files);
    }
  }

  return { files: uploaded };
}

export function useDeleteKnowledge() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/knowledge/${id}`, {
        method: "DELETE",
      }),
  });
}

export function useConfirmExtraction() {
  return useMutation({
    mutationFn: ({
      projectId,
      id,
      data,
    }: {
      projectId: string;
      id: string;
      data: { action: string; editedData?: any };
    }) =>
      apiFetch<any>(`/projects/${projectId}/knowledge/${id}/confirm`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

// ─── Schemas ────────────────────────────────────────────────
export function useListSchemas(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/schemas`] as QueryKey,
    queryFn: () => apiFetch<SchemaItem[]>(`/projects/${projectId}/schemas`),
    enabled: !!projectId,
  });
}

export function useCreateSchema() {
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: any }) =>
      apiFetch<any>(`/projects/${projectId}/schemas`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useUpdateSchema() {
  return useMutation({
    mutationFn: ({
      projectId,
      id,
      data,
    }: {
      projectId: string;
      id: string;
      data: any;
    }) =>
      apiFetch<any>(`/projects/${projectId}/schemas/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  });
}

export function useDeleteSchema() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/schemas/${id}`, {
        method: "DELETE",
      }),
  });
}

export function useAutoGenerateSchema() {
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: { sampleText: string; surveyType?: string | null };
    }) =>
      apiFetch<any>(`/projects/${projectId}/schemas/auto-generate`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

// ─── Reports ────────────────────────────────────────────────
export function useListReports(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/reports`] as QueryKey,
    queryFn: () => apiFetch<ReportItem[]>(`/projects/${projectId}/reports`),
    enabled: !!projectId,
    refetchInterval: (query) =>
      reportPollingInterval(query.state.data as ReportItem[] | undefined),
  });
}

export function useGetReport(projectId: string, id: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/reports`, id] as QueryKey,
    queryFn: () => apiFetch<ReportItem>(`/projects/${projectId}/reports/${id}`),
    enabled: !!projectId && !!id,
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        name: string;
        templateId?: string;
        sourceIds?: string[];
        includeStatistics?: boolean;
        includeSentiment?: boolean;
        includeThemes?: boolean;
        customPrompt?: string | null;
      };
    }) =>
      apiFetch<ReportItem>(`/projects/${projectId}/reports`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useDeleteReport() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/reports/${id}`, {
        method: "DELETE",
      }),
  });
}

// ─── Chat ───────────────────────────────────────────────────
export function useGetChatHistory(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/chat`] as QueryKey,
    queryFn: () => apiFetch<any[]>(`/projects/${projectId}/chat`),
    enabled: !!projectId,
  });
}

// ─── Templates ──────────────────────────────────────────────
export function useListTemplates(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/templates`] as QueryKey,
    queryFn: () => apiFetch<TemplateItem[]>(`/projects/${projectId}/templates`),
    enabled: !!projectId,
  });
}

export function useUploadTemplate() {
  return useMutation({
    mutationFn: ({
      projectId,
      file,
      name,
      isDefault,
    }: {
      projectId: string;
      file: File;
      name: string;
      isDefault?: boolean;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      if (isDefault) formData.append("isDefault", "true");

      return apiUpload<TemplateUploadResponse>(
        `/projects/${projectId}/templates`,
        formData,
      );
    },
  });
}

export function useSetDefaultTemplate() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/templates/${id}/set-default`, {
        method: "POST",
      }),
  });
}

export function useDeleteTemplate() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/templates/${id}`, {
        method: "DELETE",
      }),
  });
}
