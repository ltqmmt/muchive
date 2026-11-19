"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

/** 브라우저용 Supabase 클라이언트. 세션은 쿠키에 저장되어 새로고침 후에도 유지된다. */
export function getSupabase() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    )
  }
  return client
}

/** 이메일 확인 링크가 돌아올 인증 경로 (Supabase Redirect URLs에 등록된 주소) */
export function confirmRedirectUrl() {
  return `${window.location.origin}/auth/confirm`
}
