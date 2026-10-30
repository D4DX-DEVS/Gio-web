"use client";
// Interactive admin pieces: submit buttons with pending state, confirmed deletes,
// flash messages and the media picker.
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LIMITS } from "./files";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ACCEPT = { image: IMAGE_TYPES.join(","), pdf: "application/pdf", any: [...IMAGE_TYPES, "application/pdf"].join(",") };

/** Browser-side check before upload (the server checks the bytes again). Null when fine. */
function fileProblem(f: File, accept: keyof typeof ACCEPT): string | null {
  const isImage = IMAGE_TYPES.includes(f.type);
  const isPdf = f.type === "application/pdf";
  if (accept === "image" && !isImage) return `${f.name}: choose a JPEG, PNG, GIF or WebP image.`;
  if (accept === "pdf" && !isPdf) return `${f.name}: choose a PDF.`;
  if (accept === "any" && !isImage && !isPdf) return `${f.name}: only images (JPEG, PNG, GIF, WebP) and PDFs.`;
  const max = isPdf ? LIMITS.document : LIMITS.image;
  if (f.size > max) return `${f.name} is ${(f.size / 1048576).toFixed(1)} MB; the limit is ${max / 1048576} MB.`;
  return null;
}

/** File input that previews chosen images and blocks the submit when a file is the wrong type or too big. */
export function FileInput({ name, accept = "any", multiple = false, required = false }: { name: string; accept?: keyof typeof ACCEPT; multiple?: boolean; required?: boolean }) {
  const [files, setFiles] = useState<{ name: string; url: string | null; size: number }[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => () => files.forEach((f) => f.url && URL.revokeObjectURL(f.url)), [files]);
  return (
    <div>
      <input
        type="file"
        name={name}
        multiple={multiple}
        required={required}
        accept={ACCEPT[accept]}
        className="field"
        onChange={(e) => {
          const list = [...(e.currentTarget.files ?? [])];
          const p = list.map((f) => fileProblem(f, accept)).find(Boolean) ?? null;
          e.currentTarget.setCustomValidity(p ?? "");
          setProblem(p);
          setFiles(list.map((f) => ({ name: f.name, size: f.size, url: IMAGE_TYPES.includes(f.type) ? URL.createObjectURL(f) : null })));
        }}
      />
      {problem ? <p className="mt-1 text-xs font-medium text-accent-700">{problem}</p> : null}
      {files.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <figure key={f.name} className="w-24 overflow-hidden rounded-lg border border-line bg-paper text-[11px] text-muted">
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-base font-bold text-brand-400">PDF</div>
              )}
              <figcaption className="truncate px-1 py-0.5" title={f.name}>
                {(f.size / 1048576).toFixed(1)} MB
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children = "Save",
  className = "btn btn-primary",
  name,
  value,
  formAction,
  disabled = false,
  label,
}: {
  children?: ReactNode;
  className?: string;
  name?: string;
  value?: string;
  /** Lets one form hold several actions (Save, Move, …). */
  formAction?: (fd: FormData) => void | Promise<void>;
  disabled?: boolean;
  /** Accessible name for icon-only buttons. */
  label?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} name={name} value={value} formAction={formAction} formNoValidate={Boolean(formAction)} aria-label={label} title={label}>
      {pending && !label ? "Working…" : children}
    </button>
  );
}

/**
 * Submit button that asks for confirmation first. Put it inside a <form action={serverAction}>;
 * `formAction` lets one form hold several actions (e.g. Save and Delete).
 */
export function ConfirmButton({
  children = "Delete",
  message = "Delete this item? This cannot be undone.",
  className = "btn btn-danger",
  formAction,
}: {
  children?: ReactNode;
  message?: string;
  className?: string;
  formAction?: (fd: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      formAction={formAction}
      formNoValidate
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/** Shows ?ok= / ?error= from the URL once, then removes them. */
export function Flash() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ok = sp.get("ok");
  const error = sp.get("error");
  const nonce = sp.get("n");
  const [shown, setShown] = useState<{ ok: string | null; error: string | null }>({ ok: null, error: null });
  // Capture a new message during render (it outlives the URL cleanup below). Tracking the
  // last key, and resetting it once the params are gone, lets the same message show again later.
  const key = ok || error ? `${ok ?? ""}|${error ?? ""}|${nonce ?? ""}` : null;
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (key !== lastKey) {
    setLastKey(key);
    if (key) setShown({ ok, error });
  }

  useEffect(() => {
    if (!ok && !error) return;
    const rest = new URLSearchParams(sp.toString());
    rest.delete("ok");
    rest.delete("error");
    rest.delete("n");
    const q = rest.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [ok, error, sp, router, pathname]);

  const msg = shown.error ?? shown.ok;
  if (!msg) return null;
  return (
    <div
      role="status"
      className={`mb-5 flex items-start justify-between gap-4 rounded-lg px-4 py-3 text-sm ring-1 ${shown.error ? "bg-red-50 text-accent-700 ring-red-200" : "bg-green-50 text-green-800 ring-green-200"}`}
    >
      <span>{msg}</span>
      <button type="button" className="font-semibold opacity-70 hover:opacity-100" onClick={() => setShown({ ok: null, error: null })} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export interface MediaOption {
  id: number;
  url: string;
  name: string;
  alt: string | null;
}

/**
 * Picks an image from the media library. Submits the chosen id as a hidden input named `name`.
 * Pass `options` (from listImageOptions()) or leave it out: the list is then fetched from
 * /admin/media-options/ when the dialog opens. `preview` shows the current image before that.
 */
export function MediaPicker({
  name,
  options: given,
  defaultId,
  preview,
  label = "Image",
  folder = "images",
}: {
  name: string;
  options?: MediaOption[];
  defaultId?: number | null;
  preview?: MediaOption | null;
  label?: string;
  /** R2 folder for images uploaded from the picker (images, banners, leaders, logos). */
  folder?: string;
}) {
  const [id, setId] = useState<number | null>(defaultId ?? null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(60);
  const [loaded, setLoaded] = useState<MediaOption[] | null>(null);
  const [uploaded, setUploaded] = useState<MediaOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const options = useMemo(() => [...uploaded, ...(given ?? loaded ?? []).filter((o) => !uploaded.some((u) => u.id === o.id))], [given, loaded, uploaded]);

  async function upload(f: File) {
    const p = fileProblem(f, "image");
    if (p) return setUploadError(p);
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("file", f);
      body.set("kind", "image");
      body.set("folder", folder);
      const res = await fetch("/admin/media-upload/?json=1", { method: "POST", body });
      const data = (await res.json().catch(() => ({ ok: false, error: `Upload failed (${res.status}).` }))) as { ok: boolean; error?: string; media?: MediaOption };
      if (!data.ok || !data.media) throw new Error(data.error ?? "Upload failed.");
      setUploaded((u) => [data.media!, ...u]);
      setId(data.media.id);
      setOpen(false);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  useEffect(() => {
    if (!open || given || loaded) return;
    fetch("/admin/media-options/")
      .then((r) => (r.ok ? (r.json() as Promise<MediaOption[]>) : []))
      .then((x) => setLoaded(x))
      .catch(() => setLoaded([]));
  }, [open, given, loaded]);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const current = id !== null ? (byId.get(id) ?? (preview?.id === id ? preview : undefined)) : undefined;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.name.toLowerCase().includes(t) || (o.alt ?? "").toLowerCase().includes(t) || String(o.id) === t) : options;
  }, [q, options]);

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={id ?? ""} />
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url} alt={current.alt ?? ""} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="text-xs text-muted">{id !== null ? `#${id}` : "None"}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
            Choose…
          </button>
          {id !== null ? (
            <button type="button" className="text-left text-xs text-accent-700 hover:underline" onClick={() => setId(null)}>
              Remove
            </button>
          ) : null}
        </div>
        {current ? <span className="hidden max-w-[16rem] truncate text-xs text-muted sm:block">{current.name}</span> : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
              <input className="field min-w-0 flex-1" placeholder="Search file name, alt text or id" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT.image}
                className="hidden"
                data-picker-upload
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) void upload(f);
                }}
              />
              <button type="button" className="btn btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Uploading…" : "Upload new image"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
              {uploadError ? <p className="w-full text-sm font-medium text-accent-700">{uploadError}</p> : null}
            </div>
            <div className="grid grid-cols-3 gap-3 overflow-y-auto p-4 sm:grid-cols-4 md:grid-cols-6">
              {filtered.slice(0, limit).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  title={o.name}
                  onClick={() => {
                    setId(o.id);
                    setOpen(false);
                  }}
                  className={`group overflow-hidden rounded-lg border text-left ${o.id === id ? "border-brand-600 ring-2 ring-brand-400" : "border-line hover:border-brand-300"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.url} alt={o.alt ?? ""} loading="lazy" className="aspect-square w-full bg-paper object-cover" />
                  <span className="block truncate px-1.5 py-1 text-[11px] text-muted">
                    #{o.id} {o.name}
                  </span>
                </button>
              ))}
              {filtered.length === 0 ? (
                <p className="col-span-full py-8 text-center text-sm text-muted">{!given && !loaded ? "Loading images…" : "No images match."}</p>
              ) : null}
            </div>
            {filtered.length > limit ? (
              <div className="border-t border-line p-3 text-center">
                <button type="button" className="btn btn-ghost" onClick={() => setLimit((l) => l + 60)}>
                  Show more ({filtered.length - limit} left)
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
