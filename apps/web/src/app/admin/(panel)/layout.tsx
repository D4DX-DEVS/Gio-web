import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { signOutAdmin } from "@/lib/auth";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { Flash } from "@/lib/admin/client";
import { AdminNav } from "./nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · GIO Admin" },
  robots: { index: false, follow: false },
};

async function signOut() {
  "use server";
  await signOutAdmin();
  redirect("/admin/login/");
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireRole("contributor");
  const items = [
    { href: "/admin/", label: "Dashboard" },
    { href: "/admin/posts/", label: "News & announcements" },
    { href: "/admin/events/", label: "Events & programmes" },
    { href: "/admin/homepage/banners/", label: "Homepage banners", group: "Homepage" },
    { href: "/admin/homepage/posters/", label: "Campaign posters" },
    { href: "/admin/homepage/videos/", label: "Videos" },
    { href: "/admin/homepage/initiatives/", label: "Initiative logos" },
    { href: "/admin/pages/", label: "Pages & sections", group: "Content" },
    { href: "/admin/leaders/", label: "Leaders" },
    { href: "/admin/gallery/", label: "Gallery" },
    { href: "/admin/media/", label: "Media library" },
    { href: "/admin/documents/", label: "Documents" },
    { href: "/admin/review/", label: "Review queue", group: "Inbox" },
    { href: "/admin/inbox/", label: "Contact inbox" },
    ...(hasRole(user, "admin")
      ? [
          { href: "/admin/menus/", label: "Menus", group: "Site" },
          { href: "/admin/urls/", label: "Legacy URLs" },
          { href: "/admin/settings/", label: "Site settings" },
          { href: "/admin/users/", label: "Admin access" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-paper lg:flex-row">
      <aside className="border-b border-line bg-brand-900 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block">
          <Link href="/admin/" className="flex items-center gap-3">
            {/* The original, not a -192x192 size: those exist only through the Worker's resize layer, so they 404 under `next dev`. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wp-content/uploads/2025/03/cropped-icon.png" alt="" className="h-9 w-9 rounded-full bg-white p-0.5" />
            <span className="text-lg font-semibold leading-tight">
              GIO Kerala
              <span className="block text-xs font-normal text-brand-200">Admin</span>
            </span>
          </Link>
          <Link href="/" target="_blank" className="text-xs text-brand-200 hover:text-white lg:mt-3 lg:inline-block">
            View website ↗
          </Link>
        </div>
        <AdminNav items={items} />
        <div className="hidden border-t border-white/10 px-5 py-4 text-sm lg:block lg:shrink-0">
          <div className="truncate font-medium">{user.name}</div>
          <div className="truncate text-xs text-brand-200">
            {user.email} · {user.role}
          </div>
          <form action={signOut} className="mt-2">
            <button className="text-xs font-semibold text-brand-100 underline-offset-2 hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center justify-end gap-3 text-sm lg:hidden">
            <span className="text-muted">{user.name}</span>
            <form action={signOut}>
              <button className="font-semibold text-brand-700">Sign out</button>
            </form>
          </div>
          <Suspense>
            <Flash />
          </Suspense>
          {children}
        </div>
      </main>
    </div>
  );
}
