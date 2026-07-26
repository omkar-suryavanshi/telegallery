const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_STORAGE_KEY = "telegallery_token";

// A plain cookie doesn't reliably work here: the frontend (Vercel) and backend (Render)
// are on unrelated domains, and mobile Safari's Intelligent Tracking Prevention blocks
// cross-domain cookies outright regardless of SameSite/Secure settings. Storing the
// token ourselves and sending it explicitly works identically in every browser.
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

class ApiClientError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // kept as a fallback for same-site/local dev
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

/** Appends the auth token as a query param — for use in <img src>/<a href> URLs, which
 * cannot send custom headers the way fetch()/XHR can. */
function withTokenParam(url: string): string {
  const token = getStoredToken();
  if (!token) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

export const api = {
  auth: {
    login: (phone: string) => request<{ loginToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
    verify: async (payload: { loginToken: string; code?: string; password?: string }) => {
      const result = await request<{
        success?: true;
        requires2FA?: true;
        loginToken?: string;
        token?: string;
        user?: { id: string; phone: string };
      }>("/auth/verify", { method: "POST", body: JSON.stringify(payload) });
      if (result.success && result.token) setStoredToken(result.token);
      return result;
    },
    me: () => request<{ user: { id: string; phone: string } }>("/auth/me"),
    logout: async () => {
      const result = await request<{ success: true }>("/auth/logout", { method: "POST" });
      clearStoredToken();
      return result;
    },
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
        const token = getStoredToken();
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
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
    downloadUrl: (id: string) => withTokenParam(`${API_BASE}/files/${id}/download`),
    thumbnailUrl: (id: string) => withTokenParam(`${API_BASE}/files/${id}/thumbnail`),
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
