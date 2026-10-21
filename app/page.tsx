"use client";

import { AppProvider } from "../components/providers";
import { Shell } from "../components/shell";

export default function Page() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
