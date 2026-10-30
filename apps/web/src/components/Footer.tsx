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
      <div className="reveal-group mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-4 lg:gap-10 lg:px-8 xl:max-w-[88rem] 2xl:max-w-[100rem]">
        <div className="col-span-2 lg:col-span-1">
          <div className="inline-block rounded-xl bg-white p-2">
            <Img media={site.logo} alt={site.name} className="h-10 w-auto sm:h-11" fallbackLabel={site.name} />
          </div>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-brand-200">
            {site.name} | {site.tagline}
          </p>
          <div className="mt-4 flex gap-2">
            {social.map((s) => (
              <a key={s.id} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="rounded-full bg-white/10 p-2 transition duration-200 hover:-translate-y-0.5 hover:bg-accent-600 hover:text-white hover:shadow-lg hover:shadow-accent-600/30 active:scale-95">
                <SocialIcon name={s.icon} className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Quick links</h2>
          <ul className="mt-3 space-y-2 text-[0.9375rem]">
            {links.map((l) => (
              <li key={l.id}>
                <Link href={l.url ?? "/"} className="link-fx inline-block hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Explore</h2>
          <ul className="mt-3 space-y-2 text-[0.9375rem]">
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="link-fx inline-block hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Contact</h2>
          <ul className="mt-3 space-y-2.5 text-[0.9375rem]">
            {site.address && (
              <li className="flex gap-2.5">
                <PinIcon className="mt-1 h-4 w-4 shrink-0 text-accent-500" />
                <span>{site.address}</span>
              </li>
            )}
            {site.phone && (
              <li className="flex gap-2.5">
                <PhoneIcon className="mt-1 h-4 w-4 shrink-0 text-accent-500" />
                <a href={`tel:${site.phone.replace(/\s+/g, "")}`} className="link-fx hover:text-white">
                  {site.phone}
                </a>
              </li>
            )}
            {site.email && (
              <li className="flex gap-2.5">
                <MailIcon className="mt-1 h-4 w-4 shrink-0 text-accent-500" />
                <a href={`mailto:${site.email}`} className="link-fx hover:text-white">
                  {site.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="reveal mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 py-4 text-sm text-brand-300 sm:flex-row sm:px-6 lg:px-8 xl:max-w-[88rem] 2xl:max-w-[100rem]">
          <span>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </span>
          <span>{site.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
