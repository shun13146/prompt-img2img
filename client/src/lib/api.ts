import type { QueueStatusInfo } from "@sd-prompt/shared";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Characters
  getCharacters: () => request<any[]>("/characters"),
  getCharacter: (id: string) => request<any>(`/characters/${id}`),
  createCharacter: (data: any) =>
    request<any>("/characters", { method: "POST", body: JSON.stringify(data) }),
  updateCharacter: (id: string, data: any) =>
    request<any>(`/characters/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCharacter: (id: string) =>
    request<void>(`/characters/${id}`, { method: "DELETE" }),

  // Tags
  getTags: () => request<any>("/tags"),
  searchTags: (q: string, limit = 20) =>
    request<any[]>(`/tags/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  toggleFavorite: (category_id: string, tag_id: string, favorite: boolean) =>
    request<any>("/tags/favorite", {
      method: "PUT",
      body: JSON.stringify({ category_id, tag_id, favorite }),
    }),

  // Queue
  getQueue: () => request<any[]>("/queue"),
  addToQueue: (data: any) =>
    request<any>("/queue", { method: "POST", body: JSON.stringify(data) }),
  updateQueueItem: (id: string, data: any) =>
    request<any>(`/queue/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteQueueItem: (id: string) =>
    request<void>(`/queue/${id}`, { method: "DELETE" }),
  clearQueue: () => request<void>("/queue", { method: "DELETE" }),
  clearHistory: () => request<void>("/queue?status=history", { method: "DELETE" }),

  // Queue runner controls
  getQueueStatus: () => request<QueueStatusInfo>("/queue/status"),
  startQueue: () => request<QueueStatusInfo>("/queue/run", { method: "POST" }),
  pauseQueue: () => request<QueueStatusInfo>("/queue/pause", { method: "POST" }),
  resumeQueue: () => request<QueueStatusInfo>("/queue/resume", { method: "POST" }),
  runQueueItem: (id: string) =>
    request<QueueStatusInfo>(`/queue/${id}/run`, { method: "POST" }),
  requeueItem: (id: string) =>
    request<any>(`/queue/${id}/requeue`, { method: "POST" }),
  moveQueueItem: (id: string, direction: "up" | "down") =>
    request<any[]>(`/queue/${id}/move`, { method: "POST", body: JSON.stringify({ direction }) }),

  // Queue SSE events
  createQueueEventSource: () => new EventSource(`${BASE}/queue/events`),

  // Forge
  getForgeStatus: () => request<{ connected: boolean; url: string }>("/forge/status"),
  getForgeModels: () => request<{ title: string; model_name: string }[]>("/forge/models"),
  getForgeSamplers: () => request<{ name: string }[]>("/forge/samplers"),

  // Settings
  getSettings: () => request<any>("/settings"),
  updateSettings: (data: any) =>
    request<any>("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Images
  listImages: (folder: string) =>
    request<{ name: string; path: string }[]>(`/images/list?folder=${encodeURIComponent(folder)}`),
  getImageUrl: (path: string) =>
    `${BASE}/images/file?path=${encodeURIComponent(path)}`,
  saveImage: (sourcePath: string, destinationFolder: string, filename?: string) =>
    request<{ saved_path: string }>("/images/save", {
      method: "POST",
      body: JSON.stringify({ sourcePath, destinationFolder, filename }),
    }),
};
