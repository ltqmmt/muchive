"use client"

/* GA4는 Vercel 운영 배포에서 측정 ID가 있을 때만 켠다. 미리보기·로컬에서는 아무것도 보내지 않는다. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? ""
export const GA_ENABLED = GA_ID.startsWith("G-") && process.env.NEXT_PUBLIC_DEPLOY_ENV === "production"

/** 주소에 남겨도 되는 쿼리 (오류 화면의 짧은 코드뿐) */
const SAFE_PARAMS = ["reason"]

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
    __gaState?: "loading" | "ready"
    __gaQueue?: unknown[][]
  }
}

/** 쿼리·해시를 뺀 주소. 이메일·인증 토큰이 실릴 수 있는 자리라 수집하지 않는다. */
export function cleanUrl(url: string) {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return ""
  }
}

/** 주소창에서 안전한 코드 외의 쿼리와 해시를 지운다 (GA가 읽기 전에) */
function scrubAddressBar() {
  const u = new URL(window.location.href)
  const keep = new URLSearchParams()
  SAFE_PARAMS.forEach((k) => {
    const v = u.searchParams.get(k)
    if (v && /^[a-z_]{1,32}$/.test(v)) keep.set(k, v)
  })
  const next = u.pathname + (keep.size ? `?${keep}` : "")
  if (next !== u.pathname + u.search + u.hash) window.history.replaceState(window.history.state, "", next)
}

function push(args: unknown[]) {
  window.dataLayer = window.dataLayer ?? []
  // gtag.js 규약: 배열이 아니라 arguments 객체를 그대로 넣어야 한다
  const gtagPush = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  } as (...a: unknown[]) => void
  gtagPush(...args)
}

/**
 * GA를 불러온다. Next.js가 첫 화면 준비(주소 동기화)를 끝낸 뒤 실행해야
 * 원래 주소가 다시 기록되지 않는다. 그래서 호출 측에서 setTimeout으로 미룬다.
 */
export function loadGa() {
  if (!GA_ENABLED || window.__gaState) return
  window.__gaState = "loading"
  scrubAddressBar()
  window.gtag = (...args: unknown[]) => push(args)
  push(["js", new Date()])
  push([
    "config",
    GA_ID,
    { page_location: cleanUrl(window.location.href), page_referrer: cleanUrl(document.referrer) },
  ])
  const s = document.createElement("script")
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)
  window.__gaState = "ready"
  ;(window.__gaQueue ?? []).forEach((args) => push(args))
  window.__gaQueue = []
}

/** GA 준비 전이면 기다렸다가, config 다음 순서로 보낸다 */
function track(...args: unknown[]) {
  if (!GA_ENABLED) return
  if (window.__gaState === "ready") push(args)
  else (window.__gaQueue = window.__gaQueue ?? []).push(args)
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
  track("event", "sign_up", { method: "email" })
  return true
}
