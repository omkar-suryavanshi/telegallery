"use client";

import { useState } from "react";
import { Search, UploadCloud } from "lucide-react";
import { useFiles } from "@/hooks/useFiles";
import { MasonryGallery } from "@/components/MasonryGallery";
import { Lightbox } from "@/components/Lightbox";
import { UploadDropzone } from "@/components/UploadDropzone";

export default function GalleryPage() {
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data, isLoading, invalidate } = useFiles({ trashed: false, q: search || undefined });
  const files = data?.items ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Gallery</h1>
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 px-3 py-2 sm:ml-auto">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename..."
            className="w-full min-w-0 bg-transparent text-sm outline-none sm:w-56"
          />
        </div>
        <button
          onClick={() => setShowUpload((s) => !s)}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <UploadCloud className="h-4 w-4" />
          Upload
        </button>
      </div>

      {showUpload && (
        <div className="mb-6">
          <UploadDropzone onUploaded={invalidate} />
        </div>
      )}

      <MasonryGallery
        files={files}
        isLoading={isLoading}
        onOpen={setLightboxIndex}
        onChanged={invalidate}
      />

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
