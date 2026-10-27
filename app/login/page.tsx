import { redirect } from "next/navigation";
import { getSessionUser } from "../../lib/auth";
import { ensureSeedUsers } from "../../lib/users";
import { getOAuthConfig } from "../../lib/oauth-config";
import { LoginForm } from "../../components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");
  await ensureSeedUsers();

  const cfg = await getOAuthConfig();
  const googleReady = Boolean(cfg.googleId && cfg.googleSecret);
  const lineReady = Boolean(cfg.lineId && cfg.lineSecret);

  return (
    <main className="login-wrap">
      <div className="login-grid">
        <section className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/play-digital.png" alt="play digital" className="login-logo" />
          <h1>Workspace ของทีม play digital</h1>
          <p>
            ปฏิทินทีม งาน & Kanban, AI Workforce, แชทกับ Drive, HR และรายงาน — รวมไว้ในระบบเดียว
            พร้อมสิทธิ์การใช้งานแยกตามบทบาท
          </p>
          <ul className="login-points">
            <li><span className="dot violet" /> ปฏิทิน 4 มุมมอง + เดดไลน์งานขึ้นอัตโนมัติ</li>
            <li><span className="dot blue" /> AI ทำงานเหมือนพนักงาน มี run log และ workload</li>
            <li><span className="dot mint" /> รายงานเชื่อม Google Drive + อนุมัติในระบบ</li>
          </ul>
          <div className="login-foot">
            <span className="pill"><span className="pulse" /> ระบบพร้อมใช้งาน</span>
            <span className="tiny muted">iPlay Workspace · Next.js + MariaDB</span>
          </div>
        </section>

        <section className="login-card">
          <LoginForm googleReady={googleReady} lineReady={lineReady} />
        </section>
      </div>
    </main>
  );
}
