import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { getServerSupabase } from "@/lib/supabase/server"

/**
 * 이메일 확인 링크가 돌아오는 인증 경로.
 * - 기본 메일 템플릿: Supabase가 확인 후 `?code=...`를 붙여 보낸다 → 세션 코드 교환
 * - 커스텀 템플릿: `?token_hash=...&type=email` → OTP 검증
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const supabase = await getServerSupabase()

  let failed = searchParams.get("error_description") ?? searchParams.get("error")

  if (!failed && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) failed = error.message
  } else if (!failed && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) failed = error.message
  } else if (!failed) {
    failed = "missing_token"
  }

  if (failed) {
    const url = new URL("/auth/error", origin)
    url.searchParams.set("reason", failed)
    return NextResponse.redirect(url)
  }
  return NextResponse.redirect(new URL("/auth/welcome", origin))
}
