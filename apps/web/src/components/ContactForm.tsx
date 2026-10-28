"use client";

import { useActionState } from "react";
import { submitContact, type ContactState } from "@/lib/contact-action";

interface Field {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

export function ContactForm({ heading, fields, submitLabel }: { heading?: string; fields: Field[]; submitLabel?: string }) {
  const [state, action, pending] = useActionState<ContactState | null, FormData>(submitContact, null);
  return (
    <form action={action} className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
      {heading && <h2 className="mb-6 font-display text-2xl font-bold text-brand-900">{heading}</h2>}
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={`c-${f.name}`} className="label">
              {f.label}
              {f.required && <span className="text-accent-600"> *</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea id={`c-${f.name}`} name={f.name} required={f.required} rows={5} className="field" maxLength={5000} />
            ) : (
              <input id={`c-${f.name}`} name={f.name} type={f.type === "email" ? "email" : "text"} required={f.required} className="field" maxLength={200} />
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
        <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-sm ${state.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary mt-6 w-full sm:w-auto">
        {pending ? "Sending…" : (submitLabel ?? "Send")}
      </button>
    </form>
  );
}
