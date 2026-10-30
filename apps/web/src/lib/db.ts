import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@gio/db";

type D1 = CloudflareEnv["DB"];

const isTransient = (e: unknown) => e instanceof TypeError && /fetch failed/.test(e.message);

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 3 || !isTransient(e)) throw e;
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
}

/**
 * `next dev` reaches the local D1 through Wrangler's platform proxy, whose HTTP connection
 * sometimes resets under load ("fetch failed / ECONNRESET"). Read-only statements are retried
 * there; writes are not, so a reset after a commit can never apply a change twice.
 * Preview and production use the binding directly, unwrapped.
 */
function withDevRetry(db: D1): D1 {
  // batch() must receive the real statements, so remember what each proxy wraps.
  const originals = new WeakMap<object, D1PreparedStatement>();
  const wrapStmt = (stmt: D1PreparedStatement, readOnly: boolean): D1PreparedStatement => {
    const p = new Proxy(stmt, {
      get(target, prop, receiver) {
        const v = Reflect.get(target, prop, receiver);
        if (typeof v !== "function") return v;
        if (prop === "bind") return (...args: unknown[]) => wrapStmt(v.apply(target, args), readOnly);
        if (readOnly && (prop === "all" || prop === "first" || prop === "run" || prop === "raw")) return (...args: unknown[]) => retry(() => v.apply(target, args));
        return v.bind(target);
      },
    });
    originals.set(p, stmt);
    return p;
  };
  return new Proxy(db, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof v !== "function") return v;
      if (prop === "prepare") return (sql: string) => wrapStmt(v.call(target, sql), /^\s*select\s/i.test(sql));
      if (prop === "batch") return (stmts: D1PreparedStatement[]) => v.call(target, stmts.map((s) => originals.get(s) ?? s));
      return v.bind(target);
    },
  });
}

// D1 bindings are request-scoped on Workers, so a client is created per call.
export function getDb() {
  const db = getCloudflareContext().env.DB;
  return createDb(process.env.NODE_ENV === "development" ? withDevRetry(db) : db);
}

export function getEnv() {
  return getCloudflareContext().env;
}
