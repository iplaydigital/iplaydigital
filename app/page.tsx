import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/auth";
import { ensureSeedUsers } from "../lib/users";
import { AppProvider } from "../components/providers";
import { Shell } from "../components/shell";

export const dynamic = "force-dynamic";

export default async function Page() {
  await ensureSeedUsers();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppProvider me={user}>
      <Shell />
    </AppProvider>
  );
}
