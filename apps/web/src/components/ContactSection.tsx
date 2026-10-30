import type { LayoutSection } from "@gio/db/layout";
import { sanitize } from "@/lib/sanitize";
import { langOf, stripHtml } from "@/lib/text";
import { ContactForm } from "./ContactForm";
import { ArrowRight, MailIcon, PhoneIcon, PinIcon } from "./Icons";
import { Container } from "./ui";

type Field = { name: string; label: string; type: string; required: boolean };
type Detail = { label: string; html: string; kind: "phone" | "email" | "address" };

/** Splits the imported "contact details" rich text (<h2> heading, then <h3> label + body pairs) into cards.
 *  Returns null when the text has another shape, so it is shown as plain rich text instead. */
function parseDetails(html: string): { heading: string | null; items: Detail[] } | null {
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const parts = html.split(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  if (parts.length < 3) return null;
  const items: Detail[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const body = parts[i + 1]?.trim() ?? "";
    if (!stripHtml(body)) continue;
    const kind = /href="tel:/i.test(body) ? "phone" : /href="mailto:/i.test(body) ? "email" : "address";
    items.push({ label: stripHtml(parts[i]), html: body, kind });
  }
  return items.length ? { heading: h2 ? stripHtml(h2[1]) : null, items } : null;
}

const ICONS = { phone: PhoneIcon, email: MailIcon, address: PinIcon };

/** Contact page: the form, the office details and the map from the page layout, shown as one block. */
export function ContactSection({ form, details, map }: { form: LayoutSection; details?: LayoutSection; map?: LayoutSection }) {
  const fields = Array.isArray(form.data.fields) ? (form.data.fields as Field[]) : [];
  const detailsHtml = details ? sanitize(String(details.data.html ?? "")) : "";
  const parsed = detailsHtml ? parseDetails(detailsHtml) : null;
  const address = parsed?.items.find((d) => d.kind === "address");
  const mapSrc = String(map?.data.embedUrl ?? "");
  const hasMap = mapSrc.startsWith("https://www.google.com/maps/embed?");

  return (
    <section className="relative pb-2">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(60%_60%_at_80%_0%,rgb(38_105_167/0.10),transparent_70%),radial-gradient(40%_50%_at_0%_30%,rgb(200_4_6/0.05),transparent_70%)]" />
      <Container className="relative pt-7 sm:pt-9">
        <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
          {detailsHtml && (
            <aside className="relative animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-pop sm:p-6 lg:col-span-2">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-accent-600/25 blur-3xl" />
              <svg className="pointer-events-none absolute right-5 top-5 h-16 w-16 text-white/10" viewBox="0 0 100 100" aria-hidden>
                <pattern id="contact-dots" width="12" height="12" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="2" fill="currentColor" />
                </pattern>
                <rect width="100" height="100" fill="url(#contact-dots)" />
              </svg>
              {parsed ? (
                <div className="relative">
                  {parsed.heading && (
                    <h2 lang={langOf(parsed.heading)} className="font-display text-lg font-bold leading-snug sm:text-xl">
                      {parsed.heading}
                    </h2>
                  )}
                  <span className="mt-3 block h-1 w-12 rounded-full bg-gradient-to-r from-accent-500 to-white/70" aria-hidden />
                  <ul className="mt-4 space-y-2.5">
                    {parsed.items.map((d) => {
                      const Icon = ICONS[d.kind];
                      return (
                        <li key={d.label} className="group flex items-start gap-3 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10 transition-colors duration-300 hover:bg-white/[0.12]">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/20 transition-all duration-300 group-hover:scale-105 group-hover:bg-white group-hover:text-brand-700">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p lang={langOf(d.label)} className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-200">
                              {d.label}
                            </p>
                            <div
                              lang={langOf(d.html)}
                              className="mt-0.5 text-[0.9375rem] font-semibold leading-snug break-words [&_a]:text-white [&_a]:underline-offset-4 [&_a:hover]:underline"
                              dangerouslySetInnerHTML={{ __html: d.html }}
                            />
                            {d.kind === "address" && hasMap && (
                              <a href="#contact-map" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-100 hover:text-white">
                                View on map <ArrowRight className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div lang={langOf(detailsHtml)} className="prose-gio relative text-white [&_a]:!text-white [&_h2]:!text-white [&_h3]:!text-white" dangerouslySetInnerHTML={{ __html: detailsHtml }} />
              )}
            </aside>
          )}
          <div className={`animate-fade-up [animation-delay:120ms] ${detailsHtml ? "lg:col-span-3" : "lg:col-span-5 lg:mx-auto lg:w-full lg:max-w-3xl"}`}>
            <ContactForm heading={String(form.data.heading ?? "Contact us")} fields={fields} submitLabel={String(form.data.submitLabel ?? "Send")} />
          </div>
        </div>

        {hasMap && (
          <div id="contact-map" className="reveal relative mt-5 overflow-hidden rounded-3xl bg-paper shadow-lift ring-1 ring-line sm:mt-6">
            <iframe src={mapSrc} title={String(map?.data.title ?? "Office location map")} className="block h-60 w-full sm:h-72" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            {address && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-sm">
                <div className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-white/95 p-3 shadow-pop ring-1 ring-line backdrop-blur">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-600 text-white">
                    <PinIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p lang={langOf(address.html)} className="text-sm font-semibold leading-snug text-ink">
                      {stripHtml(address.html)}
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stripHtml(address.html))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-accent-600"
                    >
                      Open in Google Maps ↗
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Container>
    </section>
  );
}
