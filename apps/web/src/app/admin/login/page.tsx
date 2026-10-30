import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Img } from "@/components/Img";
import { adminCredentials, getAdminUser, MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/auth";
import { getSiteInfo } from "@/lib/content";
import { SubmitButton } from "@/lib/admin/client";

export const metadata: Metadata = { title: "Sign in · GIO Admin", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getAdminUser()) redirect("/admin/");
  const [{ error }, site] = await Promise.all([searchParams, getSiteInfo()]);
  const creds = adminCredentials();
  const configured = creds !== null;
  return (
    <main className="relative isolate flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-4 py-12 sm:py-16">
      {/* Soft background shapes; purely decorative. */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 -z-10 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-accent-500/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-white/10 md:grid md:max-w-3xl md:grid-cols-[1.05fr_1fr]">
        <div className="relative flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-50 via-white to-brand-100 px-8 pb-6 pt-10 text-center md:gap-6 md:border-r md:border-line md:py-14">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-accent-600" />
          <Img media={site.logo} alt={site.name} eager className="h-20 w-auto md:h-28" fallbackLabel={site.name} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">Admin dashboard</p>
            {site.tagline ? <p className="mt-2 hidden text-sm text-muted md:block">{site.tagline}</p> : null}
          </div>
        </div>

        <div className="px-8 pb-8 pt-4 md:py-14">
          <h1 className="text-2xl font-bold text-brand-900">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to manage the website.</p>
          {!configured ? (
            <p role="alert" className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
              Admin sign-in is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD (at least {MIN_ADMIN_PASSWORD_LENGTH} characters) and, for
              production, ADMIN_TOTP_SECRET in the server environment.
            </p>
          ) : error ? (
            <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-accent-700 ring-1 ring-red-200">
              {creds.totpSecret ? "Wrong username, password or code." : "Wrong username or password."}
            </p>
          ) : null}
          {/* Plain POST to a route handler (src/app/admin/sign-in/route.ts), which can answer 429. */}
          <form action="/admin/sign-in/" method="post" className="mt-6 space-y-4">
            <label className="block">
              <span className="label">Username</span>
              <input name="username" type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} className="field" />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <input name="password" type="password" required autoComplete="current-password" className="field" />
            </label>
            {creds?.totpSecret ? (
              <label className="block">
                <span className="label">Authenticator code</span>
                <input
                  name="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  required
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="field"
                />
              </label>
            ) : null}
            <SubmitButton className="btn btn-primary mt-2 w-full">Sign in</SubmitButton>
          </form>
          <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand-700">
            <span aria-hidden>←</span> Back to website
          </Link>
        </div>
      </div>
    </main>
  );
}
