import Link from "next/link";
import type { NavItem, SiteInfo } from "@/lib/content";
import { DesktopNav } from "./DesktopNav";
import { Img } from "./Img";
import { MailIcon, PhoneIcon, SearchIcon, SocialIcon } from "./Icons";
import { MobileMenu } from "./MobileMenu";

export function Header({ site, nav, social }: { site: SiteInfo; nav: NavItem[]; social: NavItem[] }) {
  return (
    <header className="header-shadow sticky top-0 z-40 border-b border-line/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="hidden bg-brand-800 text-brand-100 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-1.5 text-xs">
          <span>{site.tagline}</span>
          <div className="flex items-center gap-5">
            {site.email && (
              <a href={`mailto:${site.email}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                <MailIcon className="h-3.5 w-3.5" />
                {site.email}
              </a>
            )}
            {site.phone && (
              <a href={`tel:${site.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                <PhoneIcon className="h-3.5 w-3.5" />
                {site.phone}
              </a>
            )}
            <span className="flex items-center gap-1 border-l border-white/15 pl-4">
              {social.map((s) => (
                <a key={s.id} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="rounded-full p-1 transition-colors hover:bg-white/10 hover:text-white">
                  <SocialIcon name={s.icon} className="h-3.5 w-3.5" />
                </a>
              ))}
            </span>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3 transition-opacity hover:opacity-85" aria-label={`${site.name} home`}>
          <Img media={site.logo} alt={site.name} eager className="h-11 w-auto sm:h-12" fallbackLabel={site.name} />
        </Link>
        <DesktopNav nav={nav} />
        <div className="flex items-center gap-1.5">
          <Link href="/search/" aria-label="Search" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition hover:bg-brand-50 hover:text-brand-700 active:scale-95">
            <SearchIcon className="h-5 w-5" />
          </Link>
          <Link
            href="/contact-us/"
            className="hidden rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-accent-700 hover:shadow-md active:translate-y-0 active:scale-[0.97] sm:inline-block"
          >
            Get in touch
          </Link>
          <MobileMenu site={site} nav={nav} social={social} />
        </div>
      </div>
    </header>
  );
}
