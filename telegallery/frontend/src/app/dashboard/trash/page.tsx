"use client";

import { useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { useFiles } from "@/hooks/useFiles";
import { MasonryGallery } from "@/components/MasonryGallery";
import { Lightbox } from "@/components/Lightbox";
import { api } from "@/lib/api";

export default function TrashPage() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { data, isLoading, invalidate } = useFiles({ trashed: true });
  const files = data?.items ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Trash</h1>
        <p className="text-sm text-neutral-500">
          Files stay here until you restore or permanently delete them.
        </p>
      </div>

      <MasonryGallery
        files={files}
        isLoading={isLoading}
        onOpen={setLightboxIndex}
        onChanged={invalidate}
        trashView
      />

      {files.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {files.map((f) => (
            <div key={f.id} className="glass-panel flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs">
              <span className="max-w-[10rem] truncate">{f.originalName}</span>
              <button
                onClick={async () => {
                  await api.files.restore(f.id);
                  invalidate();
                }}
                className="text-accent"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Permanently delete "${f.originalName}"? This cannot be undone.`)) {
                    await api.files.deletePermanent(f.id);
                    invalidate();
                  }
                }}
                className="text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          files={files}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}
