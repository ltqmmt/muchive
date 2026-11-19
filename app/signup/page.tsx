import type { Metadata } from "next";

import { SignupScreen } from "@/components/gwangeuk/auth";

export const metadata: Metadata = { title: "회원가입 · 관극 노트" };

export default function SignupPage() {
  return <SignupScreen />;
}
