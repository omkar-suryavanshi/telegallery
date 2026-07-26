"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, X, FileText, Music, Video as VideoIcon } from "lucide-react";
import { api } from "@/lib/api";

export default function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["albums", id],
    queryFn: () => api.albums.detail(id),
  });
  const album = data?.album;
  const files = album?.files.map((f) => f.file) ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["albums", id] });
    queryClient.invalidateQueries({ queryKey: ["albums"] });
  }

  async function handleRemove(fileId: string) {
    await api.albums.removeFile(id, fileId);
    invalidate();
  }

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!album) return <p className="text-sm text-neutral-500">Album not found.</p>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.push("/dashboard/albums")} className="text-neutral-400 hover:text-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-semibold">{album.name}</h1>
        <button
          onClick={() => setShowPicker(true)}
          className="ml-auto flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add files
        </button>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-neutral-300 dark:border-neutral-700 py-24 text-center">
          <p className="text-sm font-medium text-neutral-500">This album is empty</p>
          <p className="text-xs text-neutral-400">Click "Add files" to add photos, videos, or documents.</p>
        </div>
      ) : (
        <div className="masonry-grid">
          {files.map((file) => (
            <div
              key={file.id}
              className="masonry-item group relative overflow-hidden rounded-xl2 bg-neutral-100 dark:bg-neutral-800"
            >
              {file.kind === "PHOTO" ? (
                <img
                  src={api.files.thumbnailUrl(file.id)}
                  alt={file.originalName}
                  loading="lazy"
                  className="w-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    const fallbackUrl = api.files.downloadUrl(file.id);
                    if (img.src !== fallbackUrl) img.src = fallbackUrl;
                  }}
                />
              ) : (
                <div className="flex h-32 flex-col items-center justify-center gap-2 text-neutral-400">
                  {file.kind === "VIDEO" && <VideoIcon className="h-8 w-8" />}
                  {file.kind === "AUDIO" && <Music className="h-8 w-8" />}
                  {file.kind === "DOCUMENT" && <FileText className="h-8 w-8" />}
                  <span className="max-w-[80%] truncate text-xs">{file.originalName}</span>
                </div>
              )}
              <button
                onClick={() => handleRemove(file.id)}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
                title="Remove from album"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <FilePicker
          albumId={id}
          existingIds={new Set(files.map((f) => f.id))}
          onClose={() => setShowPicker(false)}
          onAdded={() => {
            invalidate();
            setShowPicker(false);
          }}
        />
      )}
    </div>
  );
}

function FilePicker({
  albumId,
  existingIds,
  onClose,
  onAdded,
}: {
  albumId: string;
  existingIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["files", { trashed: false, pageSize: 200 }],
    queryFn: () => api.files.list({ trashed: false, pageSize: 200 }),
  });
  const allFiles = (data?.items ?? []).filter((f) => !existingIds.has(f.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return onClose();
    setSaving(true);
    try {
      await api.albums.addFiles(albumId, Array.from(selected));
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-panel flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl2 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add files to album</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-neutral-500">Loading your files…</p>
          ) : allFiles.length === 0 ? (
            <p className="text-sm text-neutral-500">No other files available to add.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {allFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => toggle(file.id)}
                  className={`relative overflow-hidden rounded-lg border-2 ${
                    selected.has(file.id) ? "border-accent" : "border-transparent"
                  }`}
                >
                  {file.kind === "PHOTO" ? (
                    <img
                      src={api.files.thumbnailUrl(file.id)}
                      alt={file.originalName}
                      className="h-24 w-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget;
                        const fallbackUrl = api.files.downloadUrl(file.id);
                        if (img.src !== fallbackUrl) img.src = fallbackUrl;
                      }}
                    />
                  ) : (
                    <div className="flex h-24 w-full flex-col items-center justify-center gap-1 bg-neutral-200 px-1 text-center dark:bg-neutral-700">
                      <FileText className="h-5 w-5 text-neutral-400" />
                      <span className="line-clamp-2 text-[10px] text-neutral-500">{file.originalName}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Adding…" : `Add ${selected.size > 0 ? selected.size : ""}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
