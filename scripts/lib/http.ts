/**
 * ตัวช่วย HTTP ขนาดเล็กสำหรับสคริปต์ ops/pentest (ไม่ใช้ dependency ภายนอก)
 * - เก็บ cookie เอง (เหมือน browser session)
 * - ไม่ตาม redirect อัตโนมัติ เพื่อดูสถานะจริง
 */
export type Cookie = { name: string; value: string; flags: string[] };

export class Http {
  private jar = new Map<string, string>();
  readonly base: string;
  private lastSetCookies: Cookie[] = [];

  constructor(base: string) {
    this.base = base.replace(/\/+$/, "");
  }

  url(path: string) {
    return `${this.base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  cookiesHeader() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  /** cookie ที่เพิ่งถูก set ในคำขอล่าสุด (พร้อม flags สำหรับตรวจ security) */
  get setCookies() {
    return this.lastSetCookies;
  }

  async fetch(
    path: string,
    init: RequestInit & { timeoutMs?: number } = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    const cookie = this.cookiesHeader();
    if (cookie) headers.set("cookie", cookie);
    if (!headers.has("user-agent")) headers.set("user-agent", "iplay-prodcheck/1.0");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20_000);
    try {
      const res = await fetch(this.url(path), { ...init, headers, redirect: "manual", signal: ctrl.signal });
      this.lastSetCookies = readSetCookies(res);
      for (const c of this.lastSetCookies) {
        if (/max-age=0|expires=thu, 01 jan 1970/i.test(c.flags.join(";"))) this.jar.delete(c.name);
        else this.jar.set(c.name, c.value);
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async json<T = unknown>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T; res: Response }> {
    const res = await this.fetch(path, init);
    const text = await res.text();
    let body: T;
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = text as unknown as T;
    }
    return { status: res.status, body, res };
  }

  async login(email: string, password: string) {
    return this.json<{ ok?: boolean; error?: string }>("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  }
}

function readSetCookies(res: Response): Cookie[] {
  const raw =
    typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : splitCombined(res.headers.get("set-cookie"));
  return raw.map((line) => {
    const [pair, ...attrs] = line.split(";");
    const idx = pair.indexOf("=");
    return {
      name: pair.slice(0, idx).trim(),
      value: pair.slice(idx + 1).trim(),
      flags: attrs.map((a) => a.trim()).filter(Boolean),
    };
  });
}

/** set-cookie หลายค่าที่ fetch รวมเป็น строкาเดียวด้วย comma */
function splitCombined(value: string | null): string[] {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=\s]+=)/).map((s) => s.trim());
}

export type Result = {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "WARN" | "INFO";
  detail: string;
  severity?: "critical" | "high" | "medium" | "low" | "info";
};

export function table(rows: Result[]) {
  for (const r of rows) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : r.status === "WARN" ? "⚠️ " : "ℹ️ ";
    console.log(`${icon} ${r.id.padEnd(10)} ${r.name.padEnd(42)} ${r.detail}`);
  }
}

export function summary(rows: Result[]) {
  const fail = rows.filter((r) => r.status === "FAIL").length;
  const warn = rows.filter((r) => r.status === "WARN").length;
  const pass = rows.filter((r) => r.status === "PASS").length;
  const info = rows.filter((r) => r.status === "INFO").length;
  console.log(`\nสรุป: ผ่าน ${pass} · เตือน ${warn} · ไม่ผ่าน ${fail} · ข้อมูล ${info}`);
  return { fail, warn, pass, info };
}

export function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  if (hit.includes("=")) return hit.slice(hit.indexOf("=") + 1);
  const idx = process.argv.indexOf(hit);
  const next = process.argv[idx + 1];
  return next && !next.startsWith("--") ? next : "";
}

export function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}
