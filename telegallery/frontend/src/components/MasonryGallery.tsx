"use client";

import { useState } from "react";
import { Heart, Trash2, CheckCircle2, FileText, Music, Video as VideoIcon, RotateCcw } from "lucide-react";
import { FileItem, api } from "@/lib/api";

interface Props {
  files: FileItem[];
  isLoading: boolean;
  onOpen: (index: number) => void;
  onChanged: () => void;
  trashView?: boolean;
}

export function MasonryGallery({ files, isLoading, onOpen, onChanged, trashView }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectionMode = selected.size > 0;

  // Only the id is needed — any stopPropagation() happens at the call site, where a
  // real event is guaranteed to exist (this function must never assume it received one).
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkAction(action: "favorite" | "trash" | "restore") {
    for (const id of selected) {
      if (action === "favorite") await api.files.toggleFavorite(id);
      if (action === "trash") await api.files.trash(id);
      if (action === "restore") await api.files.restore(id);
    }
    setSelected(new Set());
    onChanged();
  }

  if (isLoading) {
    return (
      <div className="masonry-grid">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="masonry-item animate-pulse rounded-xl2 bg-neutral-200 dark:bg-neutral-800"
            style={{ height: 120 + (i % 4) * 40 }}
          />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-neutral-300 dark:border-neutral-700 py-24 text-center">
        <p className="text-sm font-medium text-neutral-500">Nothing here yet</p>
        <p className="text-xs text-neutral-400">Upload something to see it appear here.</p>
      </div>
    );
  }

  return (
    <>
      {selectionMode && (
        <div className="glass-panel sticky top-0 z-10 mb-4 flex items-center gap-3 rounded-xl px-4 py-2 text-sm">
          <span>{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            {trashView ? (
              <button onClick={() => bulkAction("restore")} className="flex items-center gap-1 text-accent">
                <RotateCcw className="h-4 w-4" /> Restore
              </button>
            ) : (
              <>
                <button onClick={() => bulkAction("favorite")} className="flex items-center gap-1 text-accent">
                  <Heart className="h-4 w-4" /> Favorite
                </button>
                <button onClick={() => bulkAction("trash")} className="flex items-center gap-1 text-red-500">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="masonry-grid">
        {files.map((file, i) => (
          <div
            key={file.id}
            onClick={() => (selectionMode ? toggleSelect(file.id) : onOpen(i))}
            className="masonry-item group relative cursor-pointer overflow-hidden rounded-xl2 bg-neutral-100 dark:bg-neutral-800 transition hover:shadow-lg"
          >
            {file.kind === "PHOTO" ? (
              <img
                src={api.files.thumbnailUrl(file.id)}
                alt={file.originalName}
                loading="lazy"
                className="w-full object-cover transition duration-300 group-hover:scale-105"
                onError={(e) => {
                  // Thumbnail generation can fail on some setups (missing native image
                  // libs) — fall back to the full-size original instead of a broken icon.
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

            <div className="absolute inset-0 flex items-start justify-between bg-black/0 p-2 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(file.id);
                }}
              >
                <CheckCircle2
                  className={`h-5 w-5 ${selected.has(file.id) ? "text-accent" : "text-white/80"}`}
                  fill={selected.has(file.id) ? "currentColor" : "none"}
                />
              </button>
              {file.isFavorite && <Heart className="h-5 w-5 text-red-400" fill="currentColor" />}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
