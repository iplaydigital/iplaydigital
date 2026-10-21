"use client";

import { AppProvider } from "../../components/providers";
import { LedScreen } from "../../components/led-view";

export default function LedPage() {
  return (
    <AppProvider>
      <LedScreen />
    </AppProvider>
  );
}
