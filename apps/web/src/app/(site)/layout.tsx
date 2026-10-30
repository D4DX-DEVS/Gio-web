import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ImageLoadWatcher } from "@/components/ImageLoadWatcher";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SplashScreen } from "@/components/SplashScreen";
import { getMenu, getSiteInfo } from "@/lib/content";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [site, nav, social] = await Promise.all([getSiteInfo(), getMenu("header"), getMenu("social")]);
  return (
    <>
      <SplashScreen logo={site.logo} name={site.name} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Skip to main content
      </a>
      <Header site={site} nav={nav} social={social} />
      <main id="main" data-site className="flex-1">
        {children}
      </main>
      <Footer site={site} nav={nav} social={social} />
      <ImageLoadWatcher />
      <ScrollReveal />
    </>
  );
}
