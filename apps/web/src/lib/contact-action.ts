"use server";

import { headers } from "next/headers";
import { schema } from "@gio/db";
import { getDb } from "./db";

export interface ContactState {
  ok: boolean;
  message: string;
}

const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function submitContact(_prev: ContactState | null, form: FormData): Promise<ContactState> {
  // Honeypot: real visitors never fill this hidden field.
  if (String(form.get("website") ?? "")) return { ok: true, message: "Thank you. Your message has been sent." };

  const name = String(form.get("name") ?? "").trim().slice(0, 200);
  const email = String(form.get("email") ?? "").trim().slice(0, 200);
  const phone = String(form.get("phone") ?? "").trim().slice(0, 40) || null;
  const message = String(form.get("message") ?? "").trim().slice(0, 5000);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Please enter a valid email address." };
  if (!message) return { ok: false, message: "Please write a message." };

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "";
  await getDb()
    .insert(schema.contactSubmissions)
    .values({
      name: name || "(not given)",
      email,
      phone,
      message,
      pageUrl: "/contact-us/",
      ipHash: ip ? await sha256(`gio-contact:${ip}`) : null,
      userAgent: (h.get("user-agent") ?? "").slice(0, 300) || null,
      purgeAfter: new Date(Date.now() + RETENTION_MS),
    });
  return { ok: true, message: "Thank you. Your message has been sent to the GIO Kerala office." };
}
