"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Settings } from "@/lib/api";

const ACCENT_PRESETS = ["#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#0ea5e9", "#8b5cf6"];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const [local, setLocal] = useState<Settings | null>(null);

  useEffect(() => {
    if (data?.settings) setLocal(data.settings);
  }, [data]);

  useEffect(() => {
    if (local?.accentColor) {
      document.documentElement.style.setProperty("--accent-color", local.accentColor);
    }
    if (local?.theme) {
      document.documentElement.classList.toggle(
        "dark",
        local.theme === "dark" ||
          (local.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
  }, [local]);

  async function save(patch: Partial<Settings>) {
    if (!local) return;
    const next = { ...local, ...patch };
    setLocal(next);
    await api.settings.update(patch);
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  if (isLoading || !local) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

      <section className="glass-panel mb-4 rounded-xl2 p-5">
        <h2 className="mb-3 text-sm font-semibold">Appearance</h2>
        <div className="mb-4 flex gap-2">
          {(["light", "dark", "system"] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => save({ theme })}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                local.theme === theme ? "bg-accent text-white" : "bg-neutral-100 dark:bg-neutral-800"
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-neutral-500">Accent color</p>
        <div className="flex gap-2">
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              onClick={() => save({ accentColor: color })}
              className="h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900"
              style={{ backgroundColor: color, borderColor: color }}
            />
          ))}
        </div>
      </section>

      <section className="glass-panel mb-4 rounded-xl2 p-5">
        <h2 className="mb-3 text-sm font-semibold">Upload</h2>
        <label className="mb-1 block text-xs text-neutral-500">
          Compression quality: {local.uploadQuality}
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={local.uploadQuality}
          onChange={(e) => setLocal({ ...local, uploadQuality: parseInt(e.target.value, 10) })}
          onMouseUp={(e) => save({ uploadQuality: parseInt((e.target as HTMLInputElement).value, 10) })}
          className="w-full accent-accent"
        />
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={local.autoCompress}
            onChange={(e) => save({ autoCompress: e.target.checked })}
          />
          Automatically compress large uploads
        </label>
      </section>
    </div>
  );
}
