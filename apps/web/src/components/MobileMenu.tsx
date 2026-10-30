"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { NavItem, SiteInfo } from "@/lib/content";
import { isCurrent } from "./DesktopNav";
import { MailIcon, PhoneIcon, SocialIcon } from "./Icons";
import { CloseButton, Modal } from "./Modal";

export function MobileMenu({ site, nav, social }: { site: SiteInfo; nav: NavItem[]; social: NavItem[] }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  const linkClass = (url: string | null, sub = false) =>
    `block rounded-lg px-3 ${sub ? "py-2.5 text-base" : "py-3 text-lg font-medium"} transition-colors ${
      isCurrent(url, pathname) ? "bg-brand-50 font-semibold text-brand-700" : sub ? "text-muted hover:bg-paper hover:text-brand-700" : "text-ink hover:bg-paper hover:text-brand-700"
    }`;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpenOn(pathname)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label="Open menu"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition hover:bg-brand-50 active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <Modal open={open} onClose={close} labelledBy="mobile-menu-title" variant="drawer">
        <div id="mobile-menu" className="flex min-h-full flex-col">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-5 py-3 backdrop-blur">
            <p id="mobile-menu-title" className="font-display text-lg font-semibold text-brand-900">
              Menu
            </p>
            <CloseButton onClick={close} label="Close menu" className="text-ink hover:bg-brand-50" />
          </div>
          <nav aria-label="Main" className="flex-1 px-3 py-3">
            <ul className="space-y-0.5">
              {nav.map((item) => (
                <li key={item.id}>
                  {item.children.length ? (
                    <details className="group" open={item.children.some((c) => isCurrent(c.url, pathname)) || undefined}>
                      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-3 text-lg font-medium text-ink transition-colors hover:bg-paper [&::-webkit-details-marker]:hidden">
                        {item.label}
                        <svg viewBox="0 0 20 20" className="h-5 w-5 text-muted transition-transform duration-200 group-open:rotate-180" fill="currentColor" aria-hidden>
                          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
                        </svg>
                      </summary>
                      <ul className="mb-2 ml-4 space-y-0.5 border-l-2 border-brand-100 pl-2">
                        {item.children.map((c) => (
                          <li key={c.id}>
                            <Link href={c.url ?? "/"} onClick={close} aria-current={isCurrent(c.url, pathname) ? "page" : undefined} className={linkClass(c.url, true)}>
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <Link href={item.url ?? "/"} onClick={close} aria-current={isCurrent(item.url, pathname) ? "page" : undefined} className={linkClass(item.url)}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
              <li>
                <Link href="/search/" onClick={close} className={linkClass("/search/")}>
                  Search
                </Link>
              </li>
            </ul>
          </nav>
          <div className="space-y-4 border-t border-line bg-paper px-5 py-5">
            <Link href="/contact-us/" onClick={close} className="block rounded-full bg-accent-600 px-5 py-3 text-center font-semibold text-white transition hover:bg-accent-700 active:scale-[0.98]">
              Get in touch
            </Link>
            <ul className="space-y-2 text-sm text-muted">
              {site.phone && (
                <li>
                  <a href={`tel:${site.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-2 py-1 hover:text-brand-700">
                    <PhoneIcon className="h-4 w-4 text-brand-500" />
                    {site.phone}
                  </a>
                </li>
              )}
              {site.email && (
                <li>
                  <a href={`mailto:${site.email}`} className="inline-flex items-center gap-2 py-1 hover:text-brand-700">
                    <MailIcon className="h-4 w-4 text-brand-500" />
                    {site.email}
                  </a>
                </li>
              )}
            </ul>
            {social.length > 0 && (
              <div className="flex gap-2">
                {social.map((s) => (
                  <a key={s.id} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-700 shadow-card ring-1 ring-line transition hover:bg-brand-600 hover:text-white">
                    <SocialIcon name={s.icon} className="h-5 w-5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
