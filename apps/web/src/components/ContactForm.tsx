"use client";

import { useActionState } from "react";
import { submitContact, type ContactState } from "@/lib/contact-action";
import { ArrowRight } from "./Icons";

interface Field {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

const input =
  "block w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink placeholder:text-muted/60 transition-[border-color,background-color,box-shadow] duration-200 hover:border-brand-200 focus:border-brand-400 focus:bg-white focus:shadow-[0_0_0_4px_rgb(38_105_167/0.12)] focus:outline-none";

export function ContactForm({ heading, fields, submitLabel }: { heading?: string; fields: Field[]; submitLabel?: string }) {
  const [state, action, pending] = useActionState<ContactState | null, FormData>(submitContact, null);
  return (
    <form action={action} className="relative h-full overflow-hidden rounded-3xl border border-line bg-white p-5 shadow-lift sm:p-6">
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-accent-600" aria-hidden />
      {heading && <h2 className="mb-4 font-display text-lg font-bold text-brand-900 sm:text-xl">{heading}</h2>}
      {/* Short fields share a row on wider screens; text areas take the full width. */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <label htmlFor={`c-${f.name}`} className="mb-1 block text-sm font-semibold text-ink">
              {f.label}
              {f.required && <span className="text-accent-600"> *</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea id={`c-${f.name}`} name={f.name} required={f.required} rows={4} placeholder={f.label} className={`${input} resize-y`} maxLength={5000} />
            ) : (
              <input id={`c-${f.name}`} name={f.name} type={f.type === "email" ? "email" : "text"} required={f.required} placeholder={f.label} className={input} maxLength={200} />
            )}
          </div>
        ))}
        <div className="hidden" aria-hidden>
          <label>
            Website <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
      </div>
      {state && (
        <p
          role="status"
          className={`mt-4 flex animate-fade-up items-start gap-3 rounded-xl px-4 py-3 text-[0.9375rem] ${state.ok ? "bg-green-50 text-green-800 ring-1 ring-green-200" : "bg-red-50 text-red-800 ring-1 ring-red-200"}`}
        >
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${state.ok ? "bg-green-600" : "bg-red-600"}`} aria-hidden>
            {state.ok ? "✓" : "!"}
          </span>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn-fx group mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 px-7 py-2.5 text-[0.9375rem] font-semibold text-white shadow-[0_10px_24px_-10px_rgb(24_92_154/0.7)] hover:from-brand-700 hover:to-brand-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            Sending…
          </>
        ) : (
          <>
            {submitLabel ?? "Send"}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </>
        )}
      </button>
    </form>
  );
}
