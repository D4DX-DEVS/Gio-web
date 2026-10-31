import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sniffMime } from "../src/files";
import { normaliseSocial } from "../src/review";
import { sanitizeContent } from "../src/lib/sanitize";
import { decodeCfEmail } from "../src/sources/html";
import {
  containsSecret,
  kolkataLocalToMs,
  percentDecode,
  redactSecrets,
  sitePath,
  stripSizeSuffix,
  uploadsKey,
  wpEncodePath,
} from "../src/lib/util";

const FAKE_KEY = `AIza${"x".repeat(35)}`;

describe("util", () => {
  it("redacts Google API keys and counts them", () => {
    const r = { count: 0 };
    const out = redactSecrets(`<iframe src="https://maps.googleapis.com/x?key=${FAKE_KEY}&q=1">`, r);
    assert.equal(r.count, 1);
    assert.ok(!containsSecret(out));
    assert.ok(containsSecret(FAKE_KEY));
  });

  it("round-trips Malayalam slugs to the lowercase-hex form WordPress emits", () => {
    const wp = "/%e0%b4%a4%e0%b4%bf%e0%b4%ac%e0%b5%8d%e0%b4%af%e0%b4%be%e0%b5%bb-25/";
    assert.equal(percentDecode(wp), "/തിബ്യാൻ-25/");
    assert.equal(wpEncodePath(percentDecode(wp)), wp);
  });

  it("maps site URLs to paths and uploads keys", () => {
    assert.equal(sitePath("https://giokerala.org/about-us/#x"), "/about-us/");
    assert.equal(sitePath("https://example.com/a/"), null);
    assert.equal(uploadsKey("https://www.giokerala.org/wp-content/uploads/2025/08/bnr1-300x200.jpg?ver=2"), "wp-content/uploads/2025/08/bnr1-300x200.jpg");
    assert.equal(stripSizeSuffix("wp-content/uploads/2025/08/bnr1-300x200.jpg"), "wp-content/uploads/2025/08/bnr1.jpg");
    assert.equal(stripSizeSuffix("wp-content/uploads/2026/01/IMG_0926-scaled-e1768740565344.jpg"), "wp-content/uploads/2026/01/IMG_0926-scaled-e1768740565344.jpg");
  });

  it("converts Asia/Kolkata wall-clock time to UTC", () => {
    assert.equal(new Date(kolkataLocalToMs("2025-12-26 08:00:00")).toISOString(), "2025-12-26T02:30:00.000Z");
  });

  it("decodes Cloudflare-obfuscated email addresses", () => {
    const email = "a.b@example.org";
    const key = 0x42;
    const hex = key.toString(16) + [...email].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, "0")).join("");
    assert.equal(decodeCfEmail(hex), email);
  });

  it("normalises social links without merging different profile ids", () => {
    assert.equal(normaliseSocial("https://www.instagram.com/abc?igsh=XYZ&utm_source=qr"), normaliseSocial("https://instagram.com/abc/"));
    assert.notEqual(
      normaliseSocial("https://www.facebook.com/profile.php?id=1"),
      normaliseSocial("https://www.facebook.com/profile.php?id=2"),
    );
  });

  it("sniffs MIME types from bytes", () => {
    assert.equal(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(sniffMime(new TextEncoder().encode("%PDF-1.7 ...")), "application/pdf");
    assert.equal(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), "image/png");
  });
});

describe("sanitizeContent", () => {
  it("keeps transliteration text, removes share widgets, scripts and unknown iframes", () => {
    const raw = `<p><span class="transliteration">ജി</span>. ഐ. ഒ</p>
      <div class="xs_social_share_widget"><ul><li><a href="#">Facebook</a></li></ul></div>
      <script>alert(1)</script><iframe src="https://evil.example/x"></iframe>
      <iframe src="https://www.youtube.com/embed/GXMUeZOmWFs"></iframe>`;
    const { html } = sanitizeContent(raw);
    assert.match(html, /<p>ജി\. ഐ\. ഒ<\/p>/);
    assert.doesNotMatch(html, /xs_social|Facebook|script|evil/);
    assert.match(html, /youtube\.com\/embed\/GXMUeZOmWFs/);
  });

  it("points resized images at the original file and reports uploads", () => {
    const raw = `<img class="aligncenter wp-image-3313 size-full" src="https://www.giokerala.org/wp-content/uploads/2025/12/x-1024x683.jpg" srcset="a 1x" width="1024" height="683" alt="">
      <a href="https://www.giokerala.org/about-us/">About</a>`;
    const { html, uploads } = sanitizeContent(raw, { resolveUpload: stripSizeSuffix });
    assert.match(html, /src="\/wp-content\/uploads\/2025\/12\/x\.jpg"/);
    assert.match(html, /class="aligncenter"/);
    assert.doesNotMatch(html, /srcset|wp-image-3313/);
    assert.match(html, /href="\/about-us\/"/);
    assert.deepEqual(uploads, [{ key: "wp-content/uploads/2025/12/x-1024x683.jpg", field: "inline" }]);
  });

  it("redacts API keys inside content", () => {
    const r = { count: 0 };
    const { html } = sanitizeContent(`<p>see https://maps.example/?key=${FAKE_KEY}</p>`, { redactions: r });
    assert.equal(r.count, 1);
    assert.ok(!containsSecret(html));
  });
});
