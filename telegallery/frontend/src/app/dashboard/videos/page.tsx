"use client";

import { useState } from "react";
import { useFiles } from "@/hooks/useFiles";
import { MasonryGallery } from "@/components/MasonryGallery";
import { Lightbox } from "@/components/Lightbox";

export default function VideosPage() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { data, isLoading, invalidate } = useFiles({ trashed: false, kind: "VIDEO" });
  const files = data?.items ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Videos</h1>
      <MasonryGallery files={files} isLoading={isLoading} onOpen={setLightboxIndex} onChanged={invalidate} />
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
