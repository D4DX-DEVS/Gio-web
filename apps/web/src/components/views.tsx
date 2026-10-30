// Page-level views shared by several routes.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeaderGroups, getCategory, getMedia, getPageLayout, getPublishedPost, listPosts, pageConfig, relatedPosts, type PageRow } from "@/lib/content";
import { sanitize } from "@/lib/sanitize";
import { formatDate, langOf, stripHtml } from "@/lib/text";
import { SocialIcon } from "./Icons";
import { Img } from "./Img";
import { LightboxScope } from "./LightboxScope";
import { Sections } from "./Sections";
import { Container, EmptyState, PageHero, Pagination, PostCard, SectionHeading } from "./ui";

const LEADER_NAV = [
  { href: "/team/", label: "State Leaders", scope: "state" },
  { href: "/district-leaders/", label: "District Leaders", scope: "district" },
  { href: "/former-leaders/", label: "Former Leaders", scope: "former" },
] as const;

export async function SectionsPage({ page }: { page: PageRow }) {
  const layout = await getPageLayout(page.id);
  const hasMap = layout?.sections.some((s) => s.type === "embed");
  return (
    <>
      <PageHero title={page.title} crumbs={[{ href: `/${page.slug}/`, label: page.title }]} />
      {layout && layout.sections.length ? (
        <div className={hasMap ? "" : "pb-8"}>
          <Sections layout={layout} pageTitle={page.title} />
        </div>
      ) : (
        <Container className="py-16">
          <EmptyState title="This page has no published content yet." />
        </Container>
      )}
    </>
  );
}

export async function LeadersPage({ page }: { page: PageRow }) {
  const scope = (pageConfig(page).scope as "state" | "district" | "former") ?? "state";
  const groups = await getLeaderGroups(scope);
  const total = groups.reduce((n, g) => n + g.leaders.length, 0);
  return (
    <>
      <PageHero title={page.title} eyebrow="Our Leaders" crumbs={[{ href: `/${page.slug}/`, label: page.title }]} />
      <div className="sticky top-[68px] z-30 border-b border-line bg-white/90 backdrop-blur md:top-[96px]">
        <Container className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
          {LEADER_NAV.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.scope === scope ? "page" : undefined} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${l.scope === scope ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100"}`}>
              {l.label}
            </Link>
          ))}
        </Container>
      </div>
      <Container className="py-10 sm:py-14">
        {!total && <EmptyState title="No leaders published for this page yet." />}
        {scope === "former" ? (
          <div className="relative space-y-12 border-l-2 border-brand-100 pl-6 sm:pl-10">
            {[...groups].reverse().map((g) => (
              <section key={g.id} className="relative">
                <span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-4 border-white bg-accent-600 shadow sm:-left-[49px]" />
                <h2 className="mb-5 font-display text-xl font-bold text-brand-800">{g.heading ?? g.termLabel}</h2>
                <LeaderGrid leaders={g.leaders} compact />
              </section>
            ))}
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.id} className="mb-12">
              {g.heading && <h2 className="mb-6 font-display text-2xl font-bold text-brand-800">{g.heading}</h2>}
              <LeaderGrid leaders={g.leaders} featuredFirst={scope === "state"} />
            </section>
          ))
        )}
      </Container>
    </>
  );
}

function LeaderGrid({ leaders, compact = false, featuredFirst = false }: { leaders: Awaited<ReturnType<typeof getLeaderGroups>>[number]["leaders"]; compact?: boolean; featuredFirst?: boolean }) {
  const featured = featuredFirst ? leaders.slice(0, 2) : [];
  const rest = featuredFirst ? leaders.slice(2) : leaders;
  return (
    <>
      {featured.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:gap-6 lg:mx-auto lg:max-w-3xl">
          {featured.map((l) => (
            <LeaderCard key={l.id} l={l} large />
          ))}
        </div>
      )}
      <div className={`grid gap-3 sm:gap-5 ${compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
        {rest.map((l) => (
          <LeaderCard key={l.id} l={l} />
        ))}
      </div>
    </>
  );
}

function LeaderCard({ l, large = false }: { l: Awaited<ReturnType<typeof getLeaderGroups>>[number]["leaders"][number]; large?: boolean }) {
  return (
    <article data-reveal className="card-lift group h-full overflow-hidden rounded-2xl border border-line bg-white text-center shadow-card">
      <div className="aspect-square overflow-hidden bg-brand-50">
        <Img media={l.photo} alt={l.name} className="zoom-media h-full w-full object-cover object-top" fallbackLabel={`No photo published for ${l.name}`} />
      </div>
      <div className={large ? "p-5" : "p-3 sm:p-4"}>
        <h3 lang={langOf(l.name)} className={`font-display font-semibold leading-snug text-brand-900 ${large ? "text-lg" : "text-sm sm:text-base"}`}>
          {l.name}
        </h3>
        {l.role && <p className={`mt-1 font-medium text-accent-600 ${large ? "text-sm" : "text-xs sm:text-sm"}`}>{l.role}</p>}
        {l.description && <p className="mt-1 text-xs text-muted">{l.description}</p>}
        {(l.facebook || l.instagram) && (
          <div className="mt-3 flex justify-center gap-2">
            {l.facebook && (
              <a href={l.facebook} target="_blank" rel="noopener noreferrer" aria-label={`${l.name} on Facebook`} className="rounded-full bg-brand-50 p-2 text-brand-600 transition hover:bg-brand-600 hover:text-white">
                <SocialIcon name="facebook" className="h-3.5 w-3.5" />
              </a>
            )}
            {l.instagram && (
              <a href={l.instagram} target="_blank" rel="noopener noreferrer" aria-label={`${l.name} on Instagram`} className="rounded-full bg-brand-50 p-2 text-brand-600 transition hover:bg-brand-600 hover:text-white">
                <SocialIcon name="instagram" className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export async function ListingPage({ page, pageNo }: { page: PageRow; pageNo: number }) {
  const cfg = pageConfig(page);
  const perPage = Number(cfg.perPage) || 9;
  const category = typeof cfg.category === "string" ? cfg.category : undefined;
  const [{ items, pages }, header] = await Promise.all([listPosts({ category }, pageNo, perPage), getMedia(typeof cfg.headerImageMediaId === "number" ? cfg.headerImageMediaId : null)]);
  if (pageNo > 1 && pageNo > pages) notFound();
  return (
    <PostGrid
      title={page.title}
      image={header}
      base={`/${page.slug}/`}
      items={items}
      page={pageNo}
      pages={pages}
      tabs={[
        { href: "/news-events/", label: "All" },
        { href: "/gio-news/", label: "GIO News" },
        { href: "/gio-events/", label: "GIO Events" },
      ]}
      current={`/${page.slug}/`}
    />
  );
}

export function PostGrid({
  title,
  eyebrow,
  image,
  base,
  items,
  page,
  pages,
  tabs,
  current,
}: {
  title: string;
  eyebrow?: string;
  image?: Awaited<ReturnType<typeof getMedia>>;
  base: string;
  items: Awaited<ReturnType<typeof listPosts>>["items"];
  page: number;
  pages: number;
  tabs?: { href: string; label: string }[];
  current?: string;
}) {
  return (
    <>
      <PageHero title={title} eyebrow={eyebrow} image={image} crumbs={[{ href: base, label: title }]} subtitle={page > 1 ? `Page ${page} of ${pages}` : undefined} />
      <Container className="py-10 sm:py-14">
        {tabs && (
          <nav aria-label="Filter stories" className="mb-8 flex flex-wrap gap-2 sm:mb-10">
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} aria-current={t.href === current ? "page" : undefined} className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition ${t.href === current ? "bg-brand-600 text-white shadow-card" : "bg-brand-50 text-brand-700 hover:bg-brand-100"}`}>
                {t.label}
              </Link>
            ))}
          </nav>
        )}
        {items.length ? (
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {items.map((p) => (
              <div key={p.id} data-reveal>
                <PostCard post={p} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing published here yet." />
        )}
        <Pagination page={page} pages={pages} base={base} />
      </Container>
    </>
  );
}

export async function PostPage({ slug }: { slug: string }) {
  const data = await getPublishedPost(slug);
  if (!data) notFound();
  const { post, card, tags } = data;
  const title = post.title || "Untitled post";
  const related = await relatedPosts(post.id, card.categories[0]?.slug);
  const body = sanitize(post.bodyHtml);
  return (
    <article>
      <header className="relative overflow-hidden bg-brand-900 text-white">
        {card.image && <Img media={card.image} alt="" eager className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-sm" />}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-900/60 to-brand-900" />
        <Container className="relative max-w-4xl py-12 sm:py-16">
          <nav aria-label="Breadcrumb" className="mb-5 animate-fade-in text-sm text-brand-200">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <span className="mx-2">/</span>
            {card.categories[0] ? (
              <Link href={`/${card.categories[0].slug}/`} className="hover:text-white">
                {card.categories[0].name.replace(/^gio /i, "GIO ")}
              </Link>
            ) : (
              <Link href="/news-events/" className="hover:text-white">
                News
              </Link>
            )}
          </nav>
          <h1 lang={langOf(title)} className="animate-fade-up text-balance font-display text-3xl font-bold leading-tight sm:text-[2.75rem] sm:leading-tight">
            {title}
          </h1>
          {post.publishedAt && (
            <p className="mt-5 text-sm text-brand-200">
              <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
            </p>
          )}
        </Container>
      </header>
      <Container className="max-w-4xl py-10 sm:py-12">
        {/* The featured photo and photos in the text open full size in the lightbox. */}
        <LightboxScope>
          {card.image && (
            <figure className="mb-10 overflow-hidden rounded-2xl shadow-pop ring-1 ring-line sm:-mt-24">
              <Img media={card.image} eager className="h-auto w-full" />
            </figure>
          )}
          {body ? <div lang={langOf(stripHtml(body, 400))} className="prose-gio" dangerouslySetInnerHTML={{ __html: body }} /> : <EmptyState title="This post has no text." />}
        </LightboxScope>
        {tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
            {tags.map((t) => (
              <Link key={t.slug} href={`/tag/${encodeURIComponent(t.slug)}/`} lang={langOf(t.name)} className="rounded-full bg-brand-50 px-3 py-1.5 text-sm text-brand-700 transition-colors hover:bg-brand-100">
                #{t.name}
              </Link>
            ))}
          </div>
        )}
      </Container>
      {related.length > 0 && (
        <section className="bg-paper py-12 sm:py-14">
          <Container>
            <SectionHeading eyebrow="Keep reading" title="More stories" action={{ href: "/news-events/", label: "All news" }} />
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {related.map((p) => (
                <div key={p.id} data-reveal>
                  <PostCard post={p} />
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}
    </article>
  );
}

export async function CategoryView({ slug, page }: { slug: string; page: number }) {
  const cat = await getCategory(slug);
  if (!cat) notFound();
  const { items, pages } = await listPosts({ category: slug }, page, 9);
  if (page > 1 && page > pages) notFound();
  return <PostGrid title={cat.name.replace(/^gio /i, "GIO ")} eyebrow="Category" base={`/category/${encodeURIComponent(slug)}/`} items={items} page={page} pages={pages} />;
}
