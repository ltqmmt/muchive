"use client"

/* GA4는 Vercel 운영 배포에서 측정 ID가 있을 때만 켠다. 미리보기·로컬에서는 아무것도 보내지 않는다. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? ""
export const GA_ENABLED = GA_ID.startsWith("G-") && process.env.NEXT_PUBLIC_DEPLOY_ENV === "production"

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

/** 수집 주소에는 쿼리(?…)와 해시(#…)를 넣지 않는다. 이메일·인증 토큰이 실릴 수 있는 자리다. */
export function cleanUrl(url: string) {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return ""
  }
}

function gtag(...args: unknown[]) {
  if (!GA_ENABLED || typeof window === "undefined") return
  window.dataLayer = window.dataLayer ?? []
  // gtag.js가 아직 로드되지 않았어도 dataLayer 큐에 쌓였다가 전송된다.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = window.gtag ?? function () { window.dataLayer!.push(arguments) }
  window.gtag(...args)
}

const SIGN_UP_COOKIE = "ga_sign_up"

/**
 * 첫 이메일 확인 직후 서버가 남긴 1회용 표시가 있을 때만 sign_up을 보내고 표시를 지운다.
 * 새로고침·재로그인·가입 버튼 클릭에는 이 표시가 없으므로 보내지 않는다.
 */
export function sendSignUpOnce() {
  const has = document.cookie.split("; ").some((c) => c === `${SIGN_UP_COOKIE}=1`)
  if (!has) return false
  document.cookie = `${SIGN_UP_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
  gtag("event", "sign_up", { method: "email" })
  return true
}

export const SIGN_UP_COOKIE_NAME = SIGN_UP_COOKIE
