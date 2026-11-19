import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * 요청마다 Supabase 세션 쿠키를 확인하고, 만료가 가까우면 새 토큰으로 갱신한다.
 * 이 덕분에 브라우저를 닫았다 열어도 로그인 상태가 유지된다.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // 토큰을 검증하고 필요하면 갱신한다. 이 호출과 응답 사이에 다른 코드를 넣지 않는다.
  await supabase.auth.getClaims()

  return response
}

export const config = {
  // 정적 파일·이미지·인증 확인 경로는 제외한다 (/auth/confirm은 스스로 세션을 만든다)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/confirm|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
