import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SearchIcon } from "@/components/Icons";
import { getMenu, getSiteInfo } from "@/lib/content";

export const metadata = { title: "Page not found" };

export default async function NotFound() {
  const [site, nav, social] = await Promise.all([getSiteInfo(), getMenu("header"), getMenu("social")]);
  return (
    <>
      <Header site={site} nav={nav} social={social} />
      <main className="flex flex-1 items-center">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="font-display text-7xl font-bold text-brand-100 sm:text-8xl">404</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-brand-900 sm:text-4xl">We couldn’t find that page</h1>
          <p className="mt-4 text-lg text-muted">The page may have moved when the GIO Kerala website was rebuilt. Try searching, or start from the homepage.</p>
          <form action="/search/" method="get" className="mx-auto mt-8 flex max-w-xl gap-2">
            <label htmlFor="nf-q" className="sr-only">
              Search
            </label>
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input id="nf-q" name="q" type="search" className="field !rounded-full !py-3 !pl-11 !text-base" placeholder="Search the site" />
            </div>
            <button className="btn btn-primary !rounded-full !px-6 !text-base">Search</button>
          </form>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-primary !px-6 !py-3 !text-base">
              Go to homepage
            </Link>
            <Link href="/news-events/" className="btn btn-ghost !px-6 !py-3 !text-base">
              Latest news
            </Link>
            <Link href="/contact-us/" className="btn btn-ghost !px-6 !py-3 !text-base">
              Contact us
            </Link>
          </div>
        </div>
      </main>
      <Footer site={site} nav={nav} social={social} />
    </>
  );
}
