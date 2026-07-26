"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Download, Heart, Trash2 } from "lucide-react";
import { FileItem, api } from "@/lib/api";

interface Props {
  files: FileItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  onChanged?: () => void;
}

export function Lightbox({ files, index, onClose, onIndexChange, onChanged }: Props) {
  const file = files[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange(Math.min(index + 1, files.length - 1));
      if (e.key === "ArrowLeft") onIndexChange(Math.max(index - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, files.length, onClose, onIndexChange]);

  if (!file) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/70 hover:text-white">
          <X className="h-6 w-6" />
        </button>

        <button
          onClick={() => onIndexChange(Math.max(index - 1, 0))}
          className="absolute left-4 text-white/50 hover:text-white disabled:opacity-20"
          disabled={index === 0}
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
        <button
          onClick={() => onIndexChange(Math.min(index + 1, files.length - 1))}
          className="absolute right-4 text-white/50 hover:text-white disabled:opacity-20"
          disabled={index === files.length - 1}
        >
          <ChevronRight className="h-8 w-8" />
        </button>

        <motion.div
          key={file.id}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex max-h-[85vh] max-w-[85vw] flex-col items-center"
        >
          {file.kind === "VIDEO" ? (
            <video src={api.files.downloadUrl(file.id)} controls autoPlay className="max-h-[75vh] rounded-lg" />
          ) : file.kind === "PHOTO" ? (
            <img
              src={api.files.downloadUrl(file.id)}
              alt={file.originalName}
              className="max-h-[75vh] rounded-lg object-contain"
            />
          ) : (
            <div className="glass-panel rounded-lg p-10 text-center text-white">
              <p className="mb-2 font-medium">{file.originalName}</p>
              <p className="text-xs text-white/60">Preview not available — download to view</p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-white/80">
            <span className="text-sm">{file.originalName}</span>
            <button
              onClick={async () => {
                await api.files.toggleFavorite(file.id);
                onChanged?.();
              }}
              className={file.isFavorite ? "text-red-400" : "hover:text-white"}
            >
              <Heart className="h-5 w-5" fill={file.isFavorite ? "currentColor" : "none"} />
            </button>
            <a href={api.files.downloadUrl(file.id)} download className="hover:text-white">
              <Download className="h-5 w-5" />
            </a>
            <button
              onClick={async () => {
                await api.files.trash(file.id);
                onChanged?.();
                onClose();
              }}
              className="hover:text-white"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
