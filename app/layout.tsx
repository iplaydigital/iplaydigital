import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iPlay Workspace — ปฏิทิน · งาน · AI Workforce",
  description:
    "ระบบบริหารงานagency iPlay Digital: ปฏิทินเต็มจอ, Kanban, AI agents, แชททีม + Google Drive, HR (เช็คอิน/ลา/จองห้อง) และเชื่อมจอ LED Park Silom",
  applicationName: "iPlay Workspace",
};

export const viewport: Viewport = {
  themeColor: "#080a13",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
