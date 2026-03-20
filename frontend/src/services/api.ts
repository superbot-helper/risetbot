/**
 * API service layer — typed hooks using @tanstack/react-query.
 * All mutations use FormData for file uploads where applicable.
 */
import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE = '/api';

/**
 * Generic JSON fetch wrapper with error handling.
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'API request failed');
  }
  return res.json();
}

/**
 * Multipart upload wrapper (no Content-Type — browser sets boundary).
 */
async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Upload failed');
  }
  return res.json();
}


// ─── Dashboard ──────────────────────────────────────────────
export function useGetDashboardStats() {
  return useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: () => apiFetch<any>('/dashboard/stats'),
  });
}

export function useGetRecentActivity() {
  return useQuery({
    queryKey: ['/api/dashboard/activity'],
    queryFn: () => apiFetch<any[]>('/dashboard/activity'),
  });
}

export function useGetProjectStatusTable() {
  return useQuery({
    queryKey: ['/api/dashboard/project-status'],
    queryFn: () => apiFetch<any[]>('/dashboard/project-status'),
  });
}


// ─── Projects ───────────────────────────────────────────────
export function useListProjects() {
  return useQuery({
    queryKey: ['/api/projects'],
    queryFn: () => apiFetch<any[]>('/projects'),
  });
}

export function useGetProject(id: string) {
  return useQuery({
    queryKey: ['/api/projects', id],
    queryFn: () => apiFetch<any>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  return useMutation({
    mutationFn: ({ data }: { data: { name: string; description?: string } }) =>
      apiFetch<any>('/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiFetch<any>(`/projects/${id}`, { method: 'DELETE' }),
  });
}


// ─── Knowledge (actual FormData file upload) ────────────────
export function useListKnowledge(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/knowledge`],
    queryFn: () => apiFetch<any[]>(`/projects/${projectId}/knowledge`),
    enabled: !!projectId,
  });
}

/**
 * Upload PDF files via multipart FormData (not base64).
 * Accepts multiple files in a single request.
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
      files.forEach((file) => formData.append('files', file));
      if (schemaId) formData.append('schemaId', schemaId);
      return apiUpload<any>(`/projects/${projectId}/knowledge`, formData);
    },
  });
}

export function useDeleteKnowledge() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/knowledge/${id}`, { method: 'DELETE' }),
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
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}


// ─── Schemas ────────────────────────────────────────────────
export function useListSchemas(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/schemas`],
    queryFn: () => apiFetch<any[]>(`/projects/${projectId}/schemas`),
    enabled: !!projectId,
  });
}

export function useCreateSchema() {
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: any }) =>
      apiFetch<any>(`/projects/${projectId}/schemas`, {
        method: 'POST',
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
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  });
}

export function useDeleteSchema() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/schemas/${id}`, { method: 'DELETE' }),
  });
}

export function useAutoGenerateSchema() {
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: { sampleText: string } }) =>
      apiFetch<any>(`/projects/${projectId}/schemas/auto-generate`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}


// ─── Reports ────────────────────────────────────────────────
export function useListReports(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/reports`],
    queryFn: () => apiFetch<any[]>(`/projects/${projectId}/reports`),
    enabled: !!projectId,
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: any }) =>
      apiFetch<any>(`/projects/${projectId}/reports`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useDeleteReport() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/reports/${id}`, { method: 'DELETE' }),
  });
}


// ─── Chat ───────────────────────────────────────────────────
export function useGetChatHistory(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/chat`],
    queryFn: () => apiFetch<any[]>(`/projects/${projectId}/chat`),
    enabled: !!projectId,
  });
}


// ─── Templates (actual DOCX file upload) ────────────────────
export function useListTemplates(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/templates`],
    queryFn: () => apiFetch<any[]>(`/projects/${projectId}/templates`),
    enabled: !!projectId,
  });
}

/**
 * Upload DOCX template via multipart FormData.
 */
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
      formData.append('file', file);
      formData.append('name', name);
      if (isDefault) formData.append('isDefault', 'true');
      return apiUpload<any>(`/projects/${projectId}/templates`, formData);
    },
  });
}

export function useSetDefaultTemplate() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/templates/${id}/set-default`, {
        method: 'POST',
      }),
  });
}

export function useDeleteTemplate() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/templates/${id}`, { method: 'DELETE' }),
  });
}
