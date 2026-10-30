/* eslint-disable @next/next/no-img-element -- original files from R2, no transformation service */
import type { LayoutItem, LayoutMedia, LayoutSection, PageLayout } from "@gio/db/layout";
import { encodePath, type PublicMedia } from "@/lib/content";
import { sanitize } from "@/lib/sanitize";
import { langOf } from "@/lib/text";
import { ChannelVideos } from "./ChannelVideos";
import { ContactSection } from "./ContactSection";
import { HeroCarousel } from "./HeroCarousel";
import { Img } from "./Img";
import { LightboxScope } from "./LightboxScope";
import { PosterMarquee } from "./PosterMarquee";
import { Container, SectionHeading } from "./ui";

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
  // A contact form takes the page's contact details and map into one block (Contact page).
  const form = secs.find((s) => s.type === "contact_form");
  const contactDetails = form && secs.find((s) => s.type === "rich_text" && s.data.kind === "contact_details");
  const contactMap = form && secs.find((s) => s.type === "map");
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    const next = secs[i + 1];
    if (s === contactDetails || s === contactMap) {
      if (inserts[i]) out.push(<div key={`ins-${i}`}>{inserts[i]}</div>);
      continue;
    }
    if (s === form) {
      out.push(<ContactSection key={s.id} form={s} details={contactDetails} map={contactMap} />);
      if (inserts[i]) out.push(<div key={`ins-${i}`}>{inserts[i]}</div>);
      continue;
    }
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
    <section className="py-9 sm:py-12">
      {/* Unlinked photos (here and in the text) open full size in the lightbox. */}
      <LightboxScope>
        <Container className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10">
          <Linked item={item} className="reveal group mx-auto block w-full max-w-sm overflow-hidden rounded-2xl shadow-lg shadow-brand-900/10 ring-1 ring-line md:sticky md:top-[calc(var(--header-h)+1.5rem)] md:max-w-none">
            <Img media={layoutMedia(item.media, item.altText)} className="zoom-media reveal-img h-auto w-full" />
          </Linked>
          <RichText html={String(text.data.html ?? "")} className="reveal-group" />
        </Container>
      </LightboxScope>
    </section>
  );
}

/** A standalone poster on a light panel with a diagonal brand band, rings and red corner brackets. */
function PosterSpotlight({ item }: { item: LayoutItem }) {
  const media = layoutMedia(item.media, item.altText);
  if (!media) return null;
  const bracket = "pointer-events-none absolute h-8 w-8 border-accent-600 transition-all duration-500 group-hover/poster:h-12 group-hover/poster:w-12";
  return (
    <div className="reveal relative isolate overflow-hidden rounded-3xl bg-paper px-5 py-8 ring-1 ring-line sm:px-10 sm:py-10 lg:py-12">
      <div aria-hidden className="absolute inset-x-[-10%] top-1/2 -z-10 h-[45%] -translate-y-1/2 -skew-y-6 bg-gradient-to-r from-brand-800 via-brand-600 to-brand-800" />
      <div aria-hidden className="absolute inset-x-[-10%] top-1/2 -z-10 mt-[12%] h-2 -skew-y-6 bg-accent-600" />
      <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 h-[26rem] w-[26rem] -translate-x-1/2 lg:h-[33rem] lg:w-[33rem] -translate-y-1/2 rounded-full border border-brand-200" />
      <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 lg:h-[43rem] lg:w-[43rem] -translate-y-1/2 rounded-full border border-dashed border-brand-200" />

      <div className="group/poster relative mx-auto w-full max-w-[16rem] sm:max-w-xs lg:max-w-sm">
        <span aria-hidden className={`${bracket} -left-3 -top-3 rounded-tl-xl border-l-[3px] border-t-[3px]`} />
        <span aria-hidden className={`${bracket} -right-3 -top-3 rounded-tr-xl border-r-[3px] border-t-[3px]`} />
        <span aria-hidden className={`${bracket} -bottom-3 -left-3 rounded-bl-xl border-b-[3px] border-l-[3px]`} />
        <span aria-hidden className={`${bracket} -bottom-3 -right-3 rounded-br-xl border-b-[3px] border-r-[3px]`} />
        <Linked item={item} className="relative block overflow-hidden rounded-lg bg-white shadow-xl shadow-brand-900/30 ring-[3px] ring-white">
          <Img media={media} className="reveal-img h-auto w-full transition duration-700 group-hover/poster:scale-[1.03]" />
        </Linked>
      </div>
    </div>
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
        <section className="py-6 sm:py-9">
          <Container>
            {s.items.map((i) => (
              <Linked key={i.id} item={i} className="reveal group block overflow-hidden rounded-2xl shadow-md shadow-brand-900/10 ring-1 ring-line transition hover:shadow-xl">
                <Img media={layoutMedia(i.media, i.altText)} className="reveal-img h-auto w-full transition duration-500 group-hover:scale-[1.01]" />
              </Linked>
            ))}
          </Container>
        </section>
      );
    case "image":
      return (
        <section className="py-8 sm:py-10">
          <LightboxScope>
            <Container className="space-y-6">
              {s.items.map((i) => (
                <PosterSpotlight key={i.id} item={i} />
              ))}
            </Container>
          </LightboxScope>
        </section>
      );
    case "rich_text":
      return (
        <section className="py-8 sm:py-10">
          <LightboxScope>
            <Container className="max-w-4xl">
              <RichText html={String(s.data.html ?? "")} className="reveal-group" />
            </Container>
          </LightboxScope>
        </section>
      );
    case "poster_slider":
      return (
        <section className="bg-paper py-10 sm:py-12 lg:py-14">
          <Container>
            {title && <SectionHeading eyebrow="Highlights" title={title} />}
            {/* Tapping a poster without a page link opens it full size in the lightbox. */}
            <LightboxScope className="reveal">
              <PosterMarquee label={title ?? "Highlights"}>
                {s.items.map((i) => (
                  // Spacing is padding, not gap, so each copy of the row is exactly one loop wide.
                  <div key={i.id} className="shrink-0 pr-3.5 sm:pr-4 lg:pr-5">
                    {/* Hover grows the whole card (not the image inside its frame); PosterMarquee leaves room for it. */}
                    <Linked item={i} className="relative block w-48 cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line transition duration-300 ease-(--ease-soft) hover:z-10 hover:scale-[1.06] hover:shadow-lift motion-reduce:hover:scale-100 sm:w-56 lg:w-64 2xl:w-72 [&_img]:cursor-pointer!">
                      <Img media={layoutMedia(i.media, i.altText)} className="skeleton aspect-[4/5] h-auto w-full object-cover" />
                    </Linked>
                  </div>
                ))}
              </PosterMarquee>
            </LightboxScope>
          </Container>
        </section>
      );
    case "featured_video":
      return <ChannelVideos featuredId={String(s.data.youtubeId ?? "")} title={title ?? "Watch"} items={s.items} maxCards={Number(s.data.maxCards) || 6} showLatest={s.data.showLatest !== false} />;
    case "logo_carousel": {
      const logos = s.items.map((i) => ({ i, m: layoutMedia(i.media, i.altText) })).filter((x) => x.m);
      if (!logos.length) return null;
      return (
        <section className="py-9 sm:py-12">
          <Container>
            <p className="reveal mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted sm:mb-6 sm:text-sm">{title}</p>
          </Container>
          <div className="reveal group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-10 lg:gap-14 group-hover:[animation-play-state:paused]">
              {[...logos, ...logos].map(({ i, m }, k) => (
                <div key={`${i.id}-${k}`} className="flex h-14 w-28 shrink-0 items-center justify-center lg:h-16 lg:w-36" aria-hidden={k >= logos.length}>
                  <img src={m!.url} alt={k < logos.length ? m!.alt : ""} className="max-h-14 w-auto max-w-full object-contain lg:max-h-16 opacity-80 grayscale transition duration-300 hover:scale-110 hover:opacity-100 hover:grayscale-0" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case "instagram_feed":
      // Removed at the user's request (2026-10-29): the "follow us" banner only repeated the header/footer link.
      // The section type stays so a real feed can be rendered here if the client settles decision C11.
      return null;
    case "embed": {
      const src = String(s.data.src ?? "");
      if (!/^https:\/\//.test(src)) return null;
      return (
        <section className="py-8">
          <Container>
            <div className="mb-3 flex justify-end">
              <a href={src} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                Open in a new tab ↗
              </a>
            </div>
            <iframe src={src} title={String(s.data.title ?? pageTitle ?? "Embedded content")} className="reveal h-[75vh] w-full rounded-2xl border border-line shadow-md" allowFullScreen loading="lazy" />
          </Container>
        </section>
      );
    }
    case "map": {
      const src = String(s.data.embedUrl ?? "");
      if (!src.startsWith("https://www.google.com/maps/embed?")) return null;
      return (
        <section className="pb-10">
          <Container>
            <iframe src={src} title={String(s.data.title ?? "Office location map")} className="reveal h-64 w-full rounded-2xl border border-line shadow-md sm:h-80" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </Container>
        </section>
      );
    }
    case "contact_form":
      return <ContactSection form={s} />;
    case "cta":
      return (
        <section className="py-10 sm:py-12">
          <Container>
            <div className="reveal rounded-3xl bg-brand-600 p-7 text-center text-white sm:p-10">
              {title && <h2 className="font-display text-xl font-bold sm:text-2xl lg:text-[1.75rem]">{title}</h2>}
              {s.items.map((i) => (
                <Linked key={i.id} item={i} className="btn-fx mt-4 inline-block rounded-full bg-white px-6 py-2.5 text-[0.9375rem] font-semibold text-brand-700 hover:bg-brand-50">
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
