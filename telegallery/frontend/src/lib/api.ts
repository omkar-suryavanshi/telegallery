const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

class ApiClientError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      /* ignore parse errors */
    }
    throw new ApiClientError(res.status, message);
  }

  return res.json();
}

export const api = {
  auth: {
    login: (phone: string) => request<{ loginToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
    verify: (payload: { loginToken: string; code?: string; password?: string }) =>
      request<{ success?: true; requires2FA?: true; loginToken?: string; user?: { id: string; phone: string } }>(
        "/auth/verify",
        { method: "POST", body: JSON.stringify(payload) }
      ),
    me: () => request<{ user: { id: string; phone: string } }>("/auth/me"),
    logout: () => request<{ success: true }>("/auth/logout", { method: "POST" }),
  },
  files: {
    list: (params: Record<string, string | number | boolean | undefined> = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return request<{ items: FileItem[]; total: number; page: number; pageSize: number }>(
        `/files${qs ? `?${qs}` : ""}`
      );
    },
    upload: (file: File, onProgress?: (pct: number) => void) => {
      const form = new FormData();
      form.append("file", file);
      return new Promise<{ file: FileItem; duplicate: boolean }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/files/upload`);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new ApiClientError(xhr.status, xhr.responseText));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });
    },
    toggleFavorite: (id: string) => request<{ file: FileItem }>(`/files/${id}/favorite`, { method: "PATCH" }),
    trash: (id: string) => request<{ file: FileItem }>(`/files/${id}`, { method: "DELETE" }),
    restore: (id: string) => request<{ file: FileItem }>(`/files/${id}/restore`, { method: "POST" }),
    deletePermanent: (id: string, purgeTelegram = false) =>
      request<{ success: true }>(`/files/${id}/permanent?purgeTelegram=${purgeTelegram}`, { method: "DELETE" }),
    downloadUrl: (id: string) => `${API_BASE}/files/${id}/download`,
    thumbnailUrl: (id: string) => `${API_BASE}/files/${id}/thumbnail`,
  },
  albums: {
    list: () => request<{ albums: Album[] }>("/albums"),
    create: (name: string) => request<{ album: Album }>("/albums", { method: "POST", body: JSON.stringify({ name }) }),
    detail: (id: string) => request<{ album: Album & { files: { file: FileItem }[] } }>(`/albums/${id}`),
    addFiles: (id: string, fileIds: string[]) =>
      request<{ success: true }>(`/albums/${id}/files`, { method: "POST", body: JSON.stringify({ fileIds }) }),
    removeFile: (id: string, fileId: string) =>
      request<{ success: true }>(`/albums/${id}/files/${fileId}`, { method: "DELETE" }),
    delete: (id: string) => request<{ success: true }>(`/albums/${id}`, { method: "DELETE" }),
  },
  stats: {
    get: () => request<Stats>("/stats"),
  },
  settings: {
    get: () => request<{ settings: Settings }>("/settings"),
    update: (data: Partial<Settings>) =>
      request<{ settings: Settings }>("/settings", { method: "PATCH", body: JSON.stringify(data) }),
  },
};

export interface FileItem {
  id: string;
  originalName: string;
  mimeType: string;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT" | "AUDIO";
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  isFavorite: boolean;
  isTrashed: boolean;
  uploadedAt: string;
}

export interface Album {
  id: string;
  name: string;
  createdAt: string;
  _count?: { files: number };
}

export interface Stats {
  totalFiles: number;
  totalStorageBytes: number;
  byKind: Record<string, number>;
  uploadsThisMonth: number;
  largestFiles: FileItem[];
  recentUploads: FileItem[];
}

export interface Settings {
  theme: "light" | "dark" | "system";
  accentColor: string;
  uploadQuality: number;
  autoCompress: boolean;
  thumbnailMaxWidth: number;
}
