"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Images,
  FolderHeart,
  Clapperboard,
  FileText,
  Heart,
  Trash2,
  Settings,
  BarChart3,
  LogOut,
} from "lucide-react";
import { api } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard/gallery", label: "Gallery", icon: Images },
  { href: "/dashboard/albums", label: "Albums", icon: FolderHeart },
  { href: "/dashboard/videos", label: "Videos", icon: Clapperboard },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/favorites", label: "Favorites", icon: Heart },
  { href: "/dashboard/trash", label: "Trash", icon: Trash2 },
  { href: "/dashboard/stats", label: "Statistics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await api.auth.logout();
    router.push("/login");
  }

  return (
    <aside className="glass-panel sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-1 rounded-none border-r p-4">
      <div className="mb-6 px-2 text-lg font-semibold text-accent">TeleGallery</div>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-accent/15 text-accent"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </aside>
  );
}
