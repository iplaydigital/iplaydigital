import { redirect } from "next/navigation";
import { getSessionUser } from "../../lib/auth";
import { AppProvider } from "../../components/providers";
import { LedScreen } from "../../components/led-view";

export const dynamic = "force-dynamic";

export default async function LedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/led");

  return (
    <AppProvider me={user}>
      <LedScreen />
    </AppProvider>
  );
}
