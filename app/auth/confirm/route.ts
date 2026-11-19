import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { getServerSupabase } from "@/lib/supabase/server"

const SIGN_UP_COOKIE = "ga_sign_up"
/** 이메일 확인 시각이 이 시간 안이면 '방금 처음 확인한 것'으로 본다 */
const FIRST_CONFIRM_WINDOW_MS = 10 * 60 * 1000

/** 오류 화면 주소에는 원문 메시지 대신 짧은 코드만 남긴다 */
function reasonCode(message: string) {
  const m = message.toLowerCase()
  if (m.includes("code verifier") || m.includes("code_verifier")) return "other_browser"
  if (m.includes("expired") || m.includes("invalid")) return "expired"
  if (m === "missing_token") return "missing"
  return "failed"
}

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
  let confirmedAt: string | undefined

  if (!failed && code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) failed = error.message
    confirmedAt = data.user?.email_confirmed_at
  } else if (!failed && tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) failed = error.message
    confirmedAt = data.user?.email_confirmed_at
  } else if (!failed) {
    failed = "missing_token"
  }

  if (failed) {
    const url = new URL("/auth/error", origin)
    url.searchParams.set("reason", reasonCode(failed))
    return NextResponse.redirect(url)
  }

  const response = NextResponse.redirect(new URL("/auth/welcome", origin))
  // 방금 처음 이메일 확인이 끝났을 때만 GA sign_up 1회용 표시를 남긴다 (완료 화면이 읽고 지운다)
  if (confirmedAt && Date.now() - new Date(confirmedAt).getTime() < FIRST_CONFIRM_WINDOW_MS) {
    response.cookies.set(SIGN_UP_COOKIE, "1", { path: "/", maxAge: 600, sameSite: "lax", secure: true })
  }
  return response
}
