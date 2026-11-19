"use client"

import { useEffect } from "react"

import { GA_ENABLED, loadGa } from "@/lib/analytics"

/**
 * GA4 태그. page_view는 GA 기본 동작(첫 로드 + 화면 이동)으로 보낸다.
 * Next.js가 첫 화면의 주소를 맞추는 작업이 모두 끝난 다음 틱에 주소창을 정리하고 GA를 불러온다.
 */
export function Analytics() {
  useEffect(() => {
    if (!GA_ENABLED) return
    const timer = window.setTimeout(loadGa, 0)
    return () => window.clearTimeout(timer)
  }, [])
  return null
}
