import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/** 라우트 핸들러·서버 함수용 Supabase 클라이언트 (쿠키 읽기/쓰기 가능) */
export async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )
}
