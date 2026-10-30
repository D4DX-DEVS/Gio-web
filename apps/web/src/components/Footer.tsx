import Link from "next/link";
import type { NavItem, SiteInfo } from "@/lib/content";
import { Img } from "./Img";
import { MailIcon, PhoneIcon, PinIcon, SocialIcon } from "./Icons";

const EXPLORE = [
  { href: "/news-events/", label: "All news & stories" },
  { href: "/events/", label: "Event calendar" },
  { href: "/gallery/", label: "Gallery" },
  { href: "/documents/", label: "Documents & downloads" },
  { href: "/call-for-papers/", label: "Call for Papers" },
  { href: "/tamkeen/", label: "Tamkeen" },
  { href: "/search/", label: "Search" },
];

export function Footer({ site, nav, social }: { site: SiteInfo; nav: NavItem[]; social: NavItem[] }) {
  const links = nav.flatMap((n) => (n.children.length ? n.children : [n]));
  return (
    <footer className="mt-auto bg-brand-900 text-brand-100">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-accent-600 to-brand-500" />
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
        <div className="col-span-2 lg:col-span-1">
          <div className="inline-block rounded-xl bg-white p-3">
            <Img media={site.logo} alt={site.name} className="h-12 w-auto" fallbackLabel={site.name} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-brand-200">
            {site.name} | {site.tagline}
          </p>
          <div className="mt-5 flex gap-2.5">
            {social.map((s) => (
              <a key={s.id} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:-translate-y-0.5 hover:bg-accent-600 hover:text-white">
                <SocialIcon name={s.icon} className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Quick links</h2>
          <ul className="mt-4 space-y-1.5 text-sm">
            {links.map((l) => (
              <li key={l.id}>
                <Link href={l.url ?? "/"} className="inline-block py-0.5 transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Explore</h2>
          <ul className="mt-4 space-y-1.5 text-sm">
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-block py-0.5 transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Contact</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {site.address && (
              <li className="flex gap-3">
                <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                <span>{site.address}</span>
              </li>
            )}
            {site.phone && (
              <li className="flex gap-3">
                <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                <a href={`tel:${site.phone.replace(/\s+/g, "")}`} className="transition-colors hover:text-white">
                  {site.phone}
                </a>
              </li>
            )}
            {site.email && (
              <li className="flex gap-3">
                <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                <a href={`mailto:${site.email}`} className="transition-colors hover:text-white">
                  {site.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-xs text-brand-300 sm:flex-row sm:px-6">
          <span>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </span>
          <span>{site.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
