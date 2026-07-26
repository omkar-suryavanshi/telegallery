"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderHeart, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

export default function AlbumsPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["albums"], queryFn: api.albums.list });
  const albums = data?.albums ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.albums.create(newName.trim());
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["albums"] });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete the album "${name}"? Your files themselves will NOT be deleted.`)) return;
    await api.albums.delete(id);
    queryClient.invalidateQueries({ queryKey: ["albums"] });
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Albums</h1>

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New album name..."
          className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-neutral-300 dark:border-neutral-700 py-24 text-center">
          <FolderHeart className="mb-2 h-8 w-8 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-500">No albums yet</p>
          <p className="text-xs text-neutral-400">
            Albums are virtual — adding a file to an album never duplicates it in Telegram.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/dashboard/albums/${album.id}`}
              className="glass-panel group relative flex flex-col gap-2 rounded-xl2 p-4 transition hover:shadow-lg"
            >
              <button
                onClick={(e) => handleDelete(e, album.id, album.name)}
                className="absolute right-3 top-3 text-neutral-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                title="Delete album"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <FolderHeart className="h-6 w-6 text-accent" />
              <p className="text-sm font-medium">{album.name}</p>
              <p className="text-xs text-neutral-500">{album._count?.files ?? 0} files</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
