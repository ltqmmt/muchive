import type { Metadata } from "next";

import { LoginScreen } from "@/components/gwangeuk/auth";

export const metadata: Metadata = { title: "로그인 · 관극 노트" };

export default function LoginPage() {
  return <LoginScreen />;
}
