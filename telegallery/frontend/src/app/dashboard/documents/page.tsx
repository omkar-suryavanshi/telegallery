"use client";

import { FileText, Download, Trash2 } from "lucide-react";
import { useFiles } from "@/hooks/useFiles";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format";

export default function DocumentsPage() {
  const { data, isLoading, invalidate } = useFiles({ trashed: false, kind: "DOCUMENT" });
  const files = data?.items ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Documents</h1>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-neutral-300 dark:border-neutral-700 py-24 text-center">
          <p className="text-sm font-medium text-neutral-500">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="glass-panel flex items-center gap-3 rounded-xl px-4 py-3">
              <FileText className="h-5 w-5 text-accent" />
              <div className="flex-1">
                <p className="text-sm font-medium">{file.originalName}</p>
                <p className="text-xs text-neutral-500">
                  {formatBytes(file.sizeBytes)} · {new Date(file.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <a href={api.files.downloadUrl(file.id)} download className="text-neutral-400 hover:text-accent">
                <Download className="h-4 w-4" />
              </a>
              <button
                onClick={async () => {
                  await api.files.trash(file.id);
                  invalidate();
                }}
                className="text-neutral-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
