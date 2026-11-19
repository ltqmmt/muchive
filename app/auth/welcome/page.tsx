import type { Metadata } from "next";

import { WelcomeScreen } from "@/components/gwangeuk/auth";

export const metadata: Metadata = { title: "가입 완료 · 관극 노트" };

export default function WelcomePage() {
  return <WelcomeScreen />;
}
