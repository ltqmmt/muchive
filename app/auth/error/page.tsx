import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthErrorScreen } from "@/components/gwangeuk/auth";

export const metadata: Metadata = { title: "이메일 확인 · 관극 노트" };

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorScreen />
    </Suspense>
  );
}
