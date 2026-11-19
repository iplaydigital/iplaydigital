import { execSync } from "node:child_process";

/** อ่านค่าจาก git แบบไม่ทำให้ build ล้ม (เช่น build จาก tarball ที่ไม่มี .git) */
function git(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const commit = process.env.APP_COMMIT || git("git rev-parse --short HEAD");
const branch = process.env.APP_BRANCH || git("git rev-parse --abbrev-ref HEAD");
const builtAt = process.env.APP_BUILT_AT || new Date().toISOString();
const isDev = process.env.NODE_ENV === "development";

// CSP: อนุญาต inline style/script ของ Next, iframe แผนที่ + LED ของ Google
// dev ต้องมี 'unsafe-eval' (react refresh) แต่ production ไม่ต้อง
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  // เปิดให้ dev server รับ request จาก preview host ของ Arena / e2b
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "*.arena.dev", "localhost", "127.0.0.1"],
  // mysql2 ต้องรันฝั่ง server เท่านั้น (อย่า bundle)
  serverExternalPackages: ["mysql2"],
  // ฝังข้อมูล build ลงในแอป → /api/health ใช้ตอบว่า production อัปเดตล่าสุดแล้วหรือยัง
  env: { APP_COMMIT: commit, APP_BRANCH: branch, APP_BUILT_AT: builtAt },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
