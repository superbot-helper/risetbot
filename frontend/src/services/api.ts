/**
 * API service layer — replaces @workspace/api-client-react hooks.
 * All hooks use @tanstack/react-query for caching/mutations.
 */
import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling.
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

// ─── Knowledge ──────────────────────────────────────────────
export function useListKnowledge(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/knowledge`],
    queryFn: () => apiFetch<any[]>(`/projects/${projectId}/knowledge`),
    enabled: !!projectId,
  });
}

export function useUploadKnowledge() {
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: any }) =>
      apiFetch<any>(`/projects/${projectId}/knowledge`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
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
    mutationFn: ({ projectId, id, data }: { projectId: string; id: string; data: { action: string } }) =>
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

// ─── Templates ──────────────────────────────────────────────
export function useListTemplates(projectId: string) {
  return useQuery({
    queryKey: [`/api/projects/${projectId}/templates`],
    queryFn: () => apiFetch<any[]>(`/projects/${projectId}/templates`),
    enabled: !!projectId,
  });
}

export function useUploadTemplate() {
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: FormData }) =>
      fetch(`${API_BASE}/projects/${projectId}/templates`, {
        method: 'POST',
        body: data,
      }).then(r => r.json()),
  });
}

export function useDeleteTemplate() {
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      apiFetch<any>(`/projects/${projectId}/templates/${id}`, { method: 'DELETE' }),
  });
}
