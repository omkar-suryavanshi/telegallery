"use client";

import { useQuery } from "@tanstack/react-query";
import { Images, Video, FileText, Music, HardDrive, CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format";

export default function StatsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: api.stats.get });

  if (isLoading || !data) return <p className="text-sm text-neutral-500">Loading…</p>;

  const cards = [
    { label: "Total files", value: data.totalFiles, icon: HardDrive },
    { label: "Photos", value: data.byKind.PHOTO ?? 0, icon: Images },
    { label: "Videos", value: data.byKind.VIDEO ?? 0, icon: Video },
    { label: "Documents", value: data.byKind.DOCUMENT ?? 0, icon: FileText },
    { label: "Audio", value: data.byKind.AUDIO ?? 0, icon: Music },
    { label: "Uploads this month", value: data.uploadsThisMonth, icon: CalendarClock },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Statistics</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-panel rounded-xl2 p-4">
            <Icon className="mb-2 h-5 w-5 text-accent" />
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-neutral-500">{label}</p>
          </div>
        ))}
        <div className="glass-panel rounded-xl2 p-4">
          <HardDrive className="mb-2 h-5 w-5 text-accent" />
          <p className="text-2xl font-semibold">{formatBytes(data.totalStorageBytes)}</p>
          <p className="text-xs text-neutral-500">Total storage used</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">Largest files</h2>
          <div className="space-y-2">
            {data.largestFiles.map((f) => (
              <div key={f.id} className="glass-panel flex justify-between rounded-lg px-3 py-2 text-sm">
                <span className="truncate">{f.originalName}</span>
                <span className="text-neutral-500">{formatBytes(f.sizeBytes)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">Recent uploads</h2>
          <div className="space-y-2">
            {data.recentUploads.map((f) => (
              <div key={f.id} className="glass-panel flex justify-between rounded-lg px-3 py-2 text-sm">
                <span className="truncate">{f.originalName}</span>
                <span className="text-neutral-500">{new Date(f.uploadedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
