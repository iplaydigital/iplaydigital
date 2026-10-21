/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  // เปิดให้ dev server รับ request จาก preview host ของ Arena / e2b
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "*.arena.dev", "localhost", "127.0.0.1"],
  // mysql2 ต้องรันฝั่ง server เท่านั้น (อย่า bundle)
  serverExternalPackages: ["mysql2"],
};
export default nextConfig;
