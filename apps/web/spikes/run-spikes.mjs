// Runs the phase-1 spike checks against a running server.
// Usage: node spikes/run-spikes.mjs http://localhost:8787 [ABCD]   (preview)
//        node spikes/run-spikes.mjs http://localhost:3000 [ABCD]   (next dev)
// Creates one disposable local user (spike-<timestamp>@example.test) per run.
import { createHmac } from "node:crypto";

const BASE = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const results = [];
const record = (spike, name, pass, detail) => {
  results.push({ spike, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${spike}] ${name}${detail ? "  -- " + detail : ""}`);
};
const get = (path, init = {}) => fetch(BASE + path, { redirect: "manual", ...init });

// ---------------------------------------------------------------- Spike A
async function spikeA() {
  const ml = encodeURIComponent("പരീക്ഷണം");
  const cases = [
    ["exact legacy path", "/spike-legacy/old-path/", 301, "/spike-legacy/new-path/"],
    ["Malayalam slug, percent-encoded (lowercase hex, as WordPress emits)", `/spike-legacy/${ml.toLowerCase()}/`, 301, "/spike-legacy/ml-target/"],
    ["Malayalam slug, percent-encoded (uppercase hex)", `/spike-legacy/${ml}/`, 301, "/spike-legacy/ml-target/"],
    ["/?p=<id> query rule", "/?p=999999", 301, "/spike-legacy/new-path/"],
    ["/wp-login.php pattern rule answers 410", "/wp-login.php", 410, null],
  ];
  for (const [name, path, status, loc] of cases) {
    const r = await get(path);
    const location = r.headers.get("location");
    const okLoc = loc === null || (location && new URL(location, BASE).pathname === loc);
    record("A", name, r.status === status && okLoc, `${r.status} ${location ?? ""}`.trim());
  }
  const r = await get("/spike-legacy/old-path");
  record("A", "no trailing slash: redirected (trailingSlash: true)", [301, 307, 308].includes(r.status), `${r.status} ${r.headers.get("location") ?? ""}`);
  const p = await get("/spike-legacy/d1-check/");
  const d1 = p.headers.get("x-spike-proxy-d1");
  record("A", "proxy ran on pass-through request", p.headers.get("x-spike-proxy") === "next", `status ${p.status}, x-spike-proxy=${p.headers.get("x-spike-proxy")}`);
  record("A", "proxy can query D1 via getCloudflareContext()", Boolean(d1?.startsWith("ok")), d1 ?? "header missing");
  const home = await get("/");
  record("A", "home page unaffected by proxy", home.status === 200, String(home.status));
}

// ---------------------------------------------------------------- Spike B
async function spikeB() {
  const r = await get("/spike/search/");
  if (r.status !== 200) return record("B", "search route", false, `${r.status} ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  record("B", "FTS5 trigram tokenizer available on D1 binding", j.tokenizers.trigram === "ok", JSON.stringify(j.tokenizers));
  for (const x of j.results) {
    console.log(`      ${x.label}: q=${x.query} (${x.codePoints} cp) raw MATCH=${JSON.stringify(x.raw_match)} LIKE=${JSON.stringify(x.raw_like)} | normalised MATCH=${JSON.stringify(x.normalised_match)} LIKE=${JSON.stringify(x.normalised_like)}`);
  }
  console.log("      highlight:", JSON.stringify(j.highlight));
  console.log("      unicode:", JSON.stringify(j.unicode));
}

// ---------------------------------------------------------------- Spike C
function describeImage(buf) {
  const b = Buffer.from(buf);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)} png`;
  return `${b.length} bytes, magic ${b.subarray(0, 4).toString("hex")}`;
}
async function spikeC() {
  const cases = [
    ["original served by R2 key", "/wp-content/uploads/2099/01/spike-test.png", 200, "1200x800 png"],
    ["WP resized URL resized through Images binding", "/wp-content/uploads/2099/01/spike-test-300x200.png", 200, "300x200 png"],
    ["WP resized URL derived from -scaled original", "/wp-content/uploads/2099/01/spike-photo-150x150.png", 200, "150x150 png"],
    ["missing original answers 404", "/wp-content/uploads/2099/01/nope-300x200.png", 404, null],
  ];
  for (const [name, path, status, size] of cases) {
    const r = await get(path);
    const body = await r.arrayBuffer();
    const got = r.status === 200 ? describeImage(body) : new TextDecoder().decode(body).slice(0, 200);
    record("C", name, r.status === status && (size === null || got === size), `${r.status} ${got} ${r.headers.get("x-spike-media") ?? ""} ${r.headers.get("content-type") ?? ""}`);
  }
}

// ---------------------------------------------------------------- Spike D
function totp(secretB32, step = 30, digits = 6) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secretB32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / step)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 10 ** digits).padStart(digits, "0");
}
class Jar {
  c = new Map();
  take(r) {
    for (const s of r.headers.getSetCookie()) {
      const [kv] = s.split(";");
      const i = kv.indexOf("=");
      this.c.set(kv.slice(0, i), kv.slice(i + 1));
    }
  }
  get header() {
    return [...this.c].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}
async function spikeD() {
  const jar = new Jar();
  const email = `spike-${Date.now()}@example.test`;
  const password = `Spike-${Math.random().toString(36).slice(2)}-pw!`;
  const post = async (path, body, j = jar) => {
    const t = Date.now();
    const r = await fetch(BASE + "/api/spike-auth" + path, {
      method: "POST",
      // follow 308 (method and body preserved), as a browser fetch would under next dev
      redirect: "follow",
      headers: { "content-type": "application/json", origin: BASE, cookie: j.header },
      body: JSON.stringify(body ?? {}),
    });
    j.take(r);
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text.slice(0, 300); }
    return { status: r.status, json, ms: Date.now() - t };
  };
  const whoami = async (j) => (await get("/spike/whoami/", { headers: { cookie: j.header } })).json();

  const su = await post("/sign-up/email", { email, password, name: "Spike Test" });
  record("D", "sign-up (email + password) through Drizzle adapter on D1", su.status === 200 && su.json?.user?.email === email, `${su.status} ${su.ms}ms role=${su.json?.user?.role} ${su.status !== 200 ? JSON.stringify(su.json).slice(0, 200) : ""}`);
  const s0 = await whoami(jar);
  record("D", "server-side getSession via next/headers after sign-up", s0.signedIn === true, JSON.stringify(s0));

  const jar2 = new Jar();
  const si = await post("/sign-in/email", { email, password }, jar2);
  record("D", "sign-in creates a new session", si.status === 200 && Boolean(si.json?.token), `${si.status} ${si.ms}ms`);
  const gs = await fetch(BASE + "/api/spike-auth/get-session", { headers: { cookie: jar2.header } });
  const gsj = await gs.json().catch(() => null);
  record("D", "GET /get-session returns the session", gs.status === 200 && gsj?.user?.email === email, `${gs.status}`);
  const bad = await post("/sign-in/email", { email, password: "wrong-password-123" }, new Jar());
  record("D", "wrong password rejected", bad.status === 401, String(bad.status));

  const en = await post("/two-factor/enable", { password }, jar2);
  const uri = en.json?.totpURI;
  record("D", "2FA enable returns TOTP URI and backup codes", en.status === 200 && Boolean(uri) && Array.isArray(en.json?.backupCodes), `${en.status} backupCodes=${en.json?.backupCodes?.length} ${en.status !== 200 ? JSON.stringify(en.json).slice(0, 200) : ""}`);
  if (!uri) return;
  const secret = new URL(uri).searchParams.get("secret");
  const vt = await post("/two-factor/verify-totp", { code: totp(secret) }, jar2);
  record("D", "2FA verify-totp (code computed locally, RFC 6238)", vt.status === 200, String(vt.status));
  const s1 = await whoami(jar2);
  record("D", "user.twoFactorEnabled true after verification", s1.user?.twoFactorEnabled === true, JSON.stringify(s1.user));

  const jar3 = new Jar();
  const si2 = await post("/sign-in/email", { email, password }, jar3);
  const pending = await whoami(jar3);
  record("D", "sign-in with 2FA on returns twoFactorRedirect and no session", si2.status === 200 && si2.json?.twoFactorRedirect === true && !pending.signedIn, JSON.stringify(si2.json).slice(0, 120));
  const vt2 = await post("/two-factor/verify-totp", { code: totp(secret) }, jar3);
  const s3 = await whoami(jar3);
  record("D", "second factor completes sign-in", vt2.status === 200 && s3.signedIn === true, `${vt2.status} signedIn=${s3.signedIn}`);

  const so = await post("/sign-out", {}, jar3);
  const s4 = await whoami(jar3);
  record("D", "sign-out revokes session", so.status === 200 && s4.signedIn === false, `${so.status}`);
  console.log(`      timings: sign-up ${su.ms}ms, sign-in ${si.ms}ms, sign-in with 2FA ${si2.ms}ms, whoami ${s3.ms}ms (server-side)`);
}

const only = process.argv[3];
for (const [k, fn] of Object.entries({ A: spikeA, B: spikeB, C: spikeC, D: spikeD })) {
  if (only && !only.includes(k)) continue;
  try {
    await fn();
  } catch (e) {
    record(k, "spike threw", false, e.stack?.split("\n").slice(0, 3).join(" | "));
  }
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${BASE}: ${results.length - failed}/${results.length} checks passed`);
process.exitCode = failed ? 1 : 0;
