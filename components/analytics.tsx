"use client"

import Script from "next/script"

import { GA_ENABLED, GA_ID } from "@/lib/analytics"

/**
 * GA4 태그. page_view는 GA 기본 동작(첫 로드 + 화면 이동)으로 보내고,
 * 첫 로드 주소와 이전 페이지 주소는 쿼리·해시를 뺀 값으로 덮어쓴다.
 */
export function Analytics() {
  if (!GA_ENABLED) return null
  const init = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
var clean = function (u) { try { var x = new URL(u); return x.origin + x.pathname; } catch (e) { return ''; } };
gtag('config', ${JSON.stringify(GA_ID)}, {
  page_location: clean(location.href),
  page_referrer: clean(document.referrer)
});`
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {init}
      </Script>
    </>
  )
}
