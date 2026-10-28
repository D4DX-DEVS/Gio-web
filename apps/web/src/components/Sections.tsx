/* eslint-disable @next/next/no-img-element -- original files from R2, no transformation service */
import type { LayoutItem, LayoutMedia, LayoutSection, PageLayout } from "@gio/db/layout";
import { encodePath, type PublicMedia } from "@/lib/content";
import { sanitize } from "@/lib/sanitize";
import { langOf } from "@/lib/text";
import { ContactForm } from "./ContactForm";
import { HeroCarousel } from "./HeroCarousel";
import { SocialIcon } from "./Icons";
import { Img } from "./Img";
import { Container, SectionHeading } from "./ui";
import { YouTube } from "./YouTube";

export function layoutMedia(m: LayoutMedia | null, alt?: string | null): PublicMedia | null {
  if (!m) return null;
  return { id: m.id, url: encodePath(m.url), width: m.width, height: m.height, alt: alt ?? m.altText ?? "", mimeType: m.mimeType };
}

function itemLink(i: LayoutItem) {
  if (!i.linkUrl) return null;
  return i.linkUrl.startsWith("/wp-content/") ? encodePath(i.linkUrl) : i.linkUrl;
}

function Linked({ item, children, className }: { item: LayoutItem; children: React.ReactNode; className?: string }) {
  const href = itemLink(item);
  if (!href) return <div className={className}>{children}</div>;
  const external = /^https?:/.test(href) || href.endsWith(".pdf");
  return (
    <a href={href} className={className} {...(external || item.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

function RichText({ html, className = "" }: { html: string; className?: string }) {
  const clean = sanitize(html);
  return <div lang={langOf(clean)} className={`prose-gio ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}

/** Headings for homepage blocks that had none on the old site (labels only, no new content). */
const DEFAULT_TITLES: Partial<Record<LayoutSection["type"], string>> = {
  poster_slider: "Campaigns & announcements",
  featured_video: "Watch",
  logo_carousel: "Our initiatives",
};

interface Props {
  layout: PageLayout;
  /** Extra blocks rendered after the section at that index (homepage: latest news, events). */
  inserts?: Record<number, React.ReactNode>;
  pageTitle?: string;
}

export function Sections({ layout, inserts = {}, pageTitle }: Props) {
  const out: React.ReactNode[] = [];
  const secs = layout.sections;
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    const next = secs[i + 1];
    // An image directly followed by text is shown side by side, as on the old About page.
    if (s.type === "image" && next?.type === "rich_text" && s.items[0]?.media) {
      out.push(<ImageWithText key={s.id} image={s} text={next} />);
      if (inserts[i]) out.push(<div key={`ins-${i}`}>{inserts[i]}</div>);
      i++;
      if (inserts[i]) out.push(<div key={`ins-${i}`}>{inserts[i]}</div>);
      continue;
    }
    out.push(<Section key={s.id} section={s} pageTitle={pageTitle} />);
    if (inserts[i]) out.push(<div key={`ins-${i}`}>{inserts[i]}</div>);
  }
  return <>{out}</>;
}

function ImageWithText({ image, text }: { image: LayoutSection; text: LayoutSection }) {
  const item = image.items[0];
  return (
    <section className="py-14 sm:py-20">
      <Container className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <Linked item={item} className="block overflow-hidden rounded-3xl shadow-xl shadow-brand-900/10 ring-1 ring-line lg:sticky lg:top-28">
          <Img media={layoutMedia(item.media, item.altText)} className="h-auto w-full" />
        </Linked>
        <RichText html={String(text.data.html ?? "")} />
      </Container>
    </section>
  );
}

function Section({ section: s, pageTitle }: { section: LayoutSection; pageTitle?: string }) {
  const title = s.title ?? DEFAULT_TITLES[s.type];
  switch (s.type) {
    case "hero_carousel": {
      const slides = s.items
        .map((i) => ({ i, m: layoutMedia(i.media, i.altText) }))
        .filter((x) => x.m)
        .map(({ i, m }) => ({ url: m!.url, alt: m!.alt, width: m!.width, height: m!.height, href: itemLink(i) }));
      return <HeroCarousel slides={slides} intervalMs={Number(s.data.intervalMs) || 5000} />;
    }
    case "image_banner":
      return (
        <section className="py-10">
          <Container>
            {s.items.map((i) => (
              <Linked key={i.id} item={i} className="group block overflow-hidden rounded-2xl shadow-lg shadow-brand-900/10 ring-1 ring-line transition hover:shadow-xl">
                <Img media={layoutMedia(i.media, i.altText)} className="h-auto w-full transition duration-500 group-hover:scale-[1.01]" />
              </Linked>
            ))}
          </Container>
        </section>
      );
    case "image":
      return (
        <section className="py-10">
          <Container className="flex justify-center">
            {s.items.map((i) => (
              <Linked key={i.id} item={i} className="block max-w-3xl overflow-hidden rounded-2xl shadow-lg shadow-brand-900/10 ring-1 ring-line">
                <Img media={layoutMedia(i.media, i.altText)} className="h-auto w-full" />
              </Linked>
            ))}
          </Container>
        </section>
      );
    case "rich_text":
      return (
        <section className="py-12">
          <Container className="max-w-4xl">
            <RichText html={String(s.data.html ?? "")} />
          </Container>
        </section>
      );
    case "poster_slider":
      return (
        <section className="bg-paper py-16">
          <Container>
            {title && <SectionHeading eyebrow="Highlights" title={title} />}
            <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:thin] sm:mx-0 sm:px-0">
              {s.items.map((i) => (
                <Linked key={i.id} item={i} className="group w-64 shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-line transition hover:-translate-y-1 hover:shadow-xl sm:w-72">
                  <Img media={layoutMedia(i.media, i.altText)} className="aspect-[4/5] h-auto w-full object-cover" />
                </Linked>
              ))}
            </div>
          </Container>
        </section>
      );
    case "featured_video": {
      const id = String(s.data.youtubeId ?? "");
      return (
        <section className="relative overflow-hidden bg-brand-900 py-16 text-white sm:py-20">
          <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
          <Container className="relative max-w-5xl">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent-500">GIO Kerala on YouTube</p>
            <h2 className="mb-8 font-display text-2xl font-bold sm:text-3xl">{title}</h2>
            <YouTube id={id} title={title ?? "GIO Kerala video"} />
          </Container>
        </section>
      );
    }
    case "logo_carousel": {
      const logos = s.items.map((i) => ({ i, m: layoutMedia(i.media, i.altText) })).filter((x) => x.m);
      if (!logos.length) return null;
      return (
        <section className="py-16">
          <Container>
            <p className="mb-8 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted">{title}</p>
          </Container>
          <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-14 group-hover:[animation-play-state:paused]">
              {[...logos, ...logos].map(({ i, m }, k) => (
                <div key={`${i.id}-${k}`} className="flex h-20 w-40 shrink-0 items-center justify-center" aria-hidden={k >= logos.length}>
                  <img src={m!.url} alt={k < logos.length ? m!.alt : ""} className="max-h-20 w-auto max-w-full object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case "instagram_feed": {
      const handle = String(s.data.handle ?? "");
      const url = String(s.data.profileUrl ?? `https://www.instagram.com/${handle}/`);
      return (
        <section className="py-14">
          <Container>
            <div className="flex flex-col items-center justify-between gap-6 rounded-3xl bg-gradient-to-r from-[#833ab4] via-[#e1306c] to-[#f77737] p-8 text-white shadow-xl sm:flex-row sm:p-10">
              <div className="flex items-center gap-5">
                <span className="rounded-2xl bg-white/20 p-4">
                  <SocialIcon name="instagram" className="h-9 w-9" />
                </span>
                <div>
                  <p className="text-sm uppercase tracking-widest text-white/80">Follow us on Instagram</p>
                  <p className="font-display text-2xl font-bold">@{handle}</p>
                </div>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-6 py-3 font-semibold text-[#c13584] shadow transition hover:scale-105">
                Open Instagram
              </a>
            </div>
          </Container>
        </section>
      );
    }
    case "embed": {
      const src = String(s.data.src ?? "");
      if (!/^https:\/\//.test(src)) return null;
      return (
        <section className="py-8">
          <Container>
            <div className="mb-4 flex justify-end">
              <a href={src} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                Open in a new tab ↗
              </a>
            </div>
            <iframe src={src} title={String(s.data.title ?? pageTitle ?? "Embedded content")} className="h-[80vh] w-full rounded-2xl border border-line shadow-lg" allowFullScreen loading="lazy" />
          </Container>
        </section>
      );
    }
    case "map": {
      const src = String(s.data.embedUrl ?? "");
      if (!src.startsWith("https://www.google.com/maps/embed?")) return null;
      return (
        <section className="pb-16">
          <Container>
            <iframe src={src} title={String(s.data.title ?? "Office location map")} className="h-96 w-full rounded-2xl border border-line shadow-lg" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </Container>
        </section>
      );
    }
    case "contact_form": {
      const fields = Array.isArray(s.data.fields) ? (s.data.fields as { name: string; label: string; type: string; required: boolean }[]) : [];
      return (
        <section className="pt-14">
          <Container className="max-w-3xl">
            <ContactForm heading={String(s.data.heading ?? "Contact us")} fields={fields} submitLabel={String(s.data.submitLabel ?? "Send")} />
          </Container>
        </section>
      );
    }
    case "cta":
      return (
        <section className="py-14">
          <Container>
            <div className="rounded-3xl bg-brand-600 p-10 text-center text-white">
              {title && <h2 className="font-display text-3xl font-bold">{title}</h2>}
              {s.items.map((i) => (
                <Linked key={i.id} item={i} className="mt-6 inline-block rounded-full bg-white px-6 py-3 font-semibold text-brand-700">
                  {i.linkLabel ?? i.heading ?? "Learn more"}
                </Linked>
              ))}
            </div>
          </Container>
        </section>
      );
    default:
      return null;
  }
}
