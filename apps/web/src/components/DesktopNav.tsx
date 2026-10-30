"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/content";
import { decodeSlug } from "@/lib/text";

/** True when the menu URL is the current page (menu URLs may be absolute or percent-encoded). */
export function isCurrent(url: string | null, pathname: string): boolean {
  if (!url) return false;
  let path: string;
  try {
    const u = new URL(url, "https://www.giokerala.org");
    if (!/(^|\.)giokerala\.org$/.test(u.hostname)) return false; // external link
    path = u.pathname;
  } catch {
    return false;
  }
  const norm = (p: string) => {
    const d = decodeSlug(p);
    return d.endsWith("/") ? d : `${d}/`;
  };
  return norm(path) === norm(pathname);
}

const item = "flex items-center gap-1 rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors xl:px-4";
const idle = "text-ink hover:bg-brand-50 hover:text-brand-700";
const active = "bg-brand-50 text-brand-700";

export function DesktopNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {nav.map((n) => {
          const childCurrent = n.children.some((c) => isCurrent(c.url, pathname));
          return (
            <li key={n.id} className="group relative">
              {n.children.length ? (
                <>
                  <button type="button" className={`${item} ${childCurrent ? active : idle} group-focus-within:bg-brand-50`} aria-haspopup="true">
                    {n.label}
                    <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-focus-within:rotate-180 group-hover:rotate-180" fill="currentColor" aria-hidden>
                      <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
                    </svg>
                  </button>
                  {/* pt-2 bridges the gap so the pointer can travel from the button to the menu. */}
                  <div className="invisible absolute left-0 top-full z-10 pt-2 opacity-0 transition duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <ul className="w-60 translate-y-1 rounded-xl border border-line bg-white p-2 shadow-lift transition duration-200 group-focus-within:translate-y-0 group-hover:translate-y-0">
                      {n.children.map((c) => {
                        const cur = isCurrent(c.url, pathname);
                        return (
                          <li key={c.id}>
                            <Link
                              href={c.url ?? "/"}
                              aria-current={cur ? "page" : undefined}
                              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${cur ? "bg-brand-50 font-semibold text-brand-700" : "text-ink hover:bg-brand-50 hover:text-brand-700"}`}
                            >
                              {c.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              ) : (
                <Link href={n.url ?? "/"} aria-current={isCurrent(n.url, pathname) ? "page" : undefined} className={`${item} ${isCurrent(n.url, pathname) ? active : idle}`}>
                  {n.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
