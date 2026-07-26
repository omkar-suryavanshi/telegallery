"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface UploadTask {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "duplicate" | "error";
  error?: string;
}

export function UploadDropzone({ onUploaded }: { onUploaded?: () => void }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newTasks: UploadTask[] = acceptedFiles.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random()}`,
      file,
      progress: 0,
      status: "pending",
    }));
    setTasks((prev) => [...newTasks, ...prev]);

    newTasks.forEach((task) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "uploading" } : t)));
      api.files
        .upload(task.file, (pct) => {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, progress: pct } : t)));
        })
        .then((result) => {
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, status: result.duplicate ? "duplicate" : "done" } : t))
          );
          onUploaded?.();
        })
        .catch((err) => {
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, status: "error", error: err.message } : t))
          );
        });
    });
  }, [onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl2 border-2 border-dashed p-8 text-center transition ${
          isDragActive
            ? "border-accent bg-accent/5"
            : "border-neutral-300 dark:border-neutral-700 hover:border-accent/50"
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mb-2 h-8 w-8 text-accent" />
        <p className="text-sm font-medium">Drag & drop files or folders here</p>
        <p className="text-xs text-neutral-500">or click to browse — multiple files supported</p>
      </div>

      {tasks.length > 0 && (
        <div className="mt-4 space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="glass-panel flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
              <span className="flex-1 truncate">{task.file.name}</span>
              {task.status === "uploading" && (
                <>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                    <div className="h-full bg-accent transition-all" style={{ width: `${task.progress}%` }} />
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                </>
              )}
              {task.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {task.status === "duplicate" && <span className="text-xs text-amber-500">already uploaded</span>}
              {task.status === "error" && <XCircle className="h-4 w-4 text-red-500" title={task.error} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
