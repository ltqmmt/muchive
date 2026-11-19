"use client"

import type { User } from "@supabase/supabase-js"
import { ChevronLeft, MailCheck } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MobileAppShell, MobileScreenHeading, MobileToolbarButton } from "@/components/ui/mobile-app-shell"
import { SuccessMark } from "@/components/ui/success-mark"
import { confirmRedirectUrl, getSupabase } from "@/lib/supabase/client"

/* ───────────── 세션 ───────────── */

/** 현재 로그인한 사용자. undefined는 아직 확인 중, null은 로그아웃 상태. */
export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => {
    const supabase = getSupabase()
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])
  return user
}

export async function signOut() {
  await getSupabase().auth.signOut()
}

/* ───────────── 공통 ───────────── */

function koreanError(message: string) {
  const m = message.toLowerCase()
  if (m.includes("invalid login credentials")) return "이메일 또는 비밀번호가 맞지 않아요."
  if (m.includes("email not confirmed")) return "아직 이메일 확인 전이에요. 받은 메일의 버튼을 눌러 주세요."
  if (m.includes("rate limit") || m.includes("for security purposes"))
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요."
  if (m.includes("password") && m.includes("characters")) return "비밀번호는 8자 이상으로 입력해 주세요."
  if (m.includes("invalid") && m.includes("email")) return "이메일 주소 형식을 확인해 주세요."
  if (m.includes("already registered")) return "이미 가입된 이메일이에요. 로그인해 주세요."
  return "문제가 생겼어요. 잠시 후 다시 시도해 주세요."
}

function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <MobileAppShell
      title={title}
      leading={
        <MobileToolbarButton aria-label="홈으로" asChild>
          <Link href="/">
            <ChevronLeft strokeWidth={2} />
          </Link>
        </MobileToolbarButton>
      }
    >
      <div className="flex flex-col gap-6 pt-2 pb-8 break-keep">{children}</div>
    </MobileAppShell>
  )
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <Input id={id} {...props} />
    </div>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-destructive">
      {message}
    </p>
  )
}

/* ───────────── 회원가입 ───────────── */

export function SignupScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) return setError("비밀번호는 8자 이상으로 입력해 주세요.")
    if (password !== confirm) return setError("비밀번호가 서로 달라요.")
    setPending(true)
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: confirmRedirectUrl() },
    })
    setPending(false)
    if (error) return setError(koreanError(error.message))
    setSentTo(email)
  }

  if (sentTo) return <CheckEmail email={sentTo} />

  return (
    <AuthShell title="회원가입">
      <MobileScreenHeading>관극 노트 시작하기</MobileScreenHeading>
      <Card>
        <form onSubmit={submit} noValidate>
          <CardContent className="flex flex-col gap-4">
            <Field
              id="signup-email"
              label="이메일"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              id="signup-password"
              label="비밀번호 (8자 이상)"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Field
              id="signup-confirm"
              label="비밀번호 확인"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <FormError message={error} />
          </CardContent>
          <CardFooter className="mt-(--card-spacing) flex-col gap-2">
            <Button type="submit" className="w-full" disabled={pending || !email || !password}>
              {pending ? "가입 중…" : "가입하고 확인 메일 받기"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <p className="text-center text-muted-foreground">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </AuthShell>
  )
}

function CheckEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | string>("idle")
  async function resend() {
    setState("sending")
    const { error } = await getSupabase().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmRedirectUrl() },
    })
    setState(error ? koreanError(error.message) : "sent")
  }
  return (
    <AuthShell title="이메일 확인">
      <Card>
        <CardHeader>
          <MailCheck className="size-8 text-primary" strokeWidth={2} aria-hidden />
          <CardTitle className="text-lg font-semibold">메일함을 확인해 주세요</CardTitle>
          <CardDescription className="leading-relaxed">
            {email}로 확인 메일을 보냈어요. 메일의 확인 링크를 누르면 가입이 끝나고 바로 로그인돼요. 가입한 이
            브라우저에서 링크를 열어 주세요.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Button variant="tertiary" className="w-full" onClick={resend} disabled={state === "sending"}>
            {state === "sending" ? "보내는 중…" : "확인 메일 다시 보내기"}
          </Button>
          {state === "sent" && <p role="status">다시 보냈어요.</p>}
          {state !== "idle" && state !== "sending" && state !== "sent" && <FormError message={state} />}
        </CardFooter>
      </Card>
    </AuthShell>
  )
}

/* ───────────── 로그인 ───────────── */

export function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    setPending(false)
    if (error) {
      setUnconfirmed(error.message.toLowerCase().includes("email not confirmed"))
      return setError(koreanError(error.message))
    }
    router.replace("/")
    router.refresh()
  }

  if (unconfirmed && email && !error) return <CheckEmail email={email} />

  return (
    <AuthShell title="로그인">
      <MobileScreenHeading>다시 만나서 반가워요</MobileScreenHeading>
      <Card>
        <form onSubmit={submit} noValidate>
          <CardContent className="flex flex-col gap-4">
            <Field
              id="login-email"
              label="이메일"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              id="login-password"
              label="비밀번호"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FormError message={error} />
            {unconfirmed && (
              <Button type="button" variant="tertiary" onClick={() => setError(null)}>
                확인 메일 다시 받기
              </Button>
            )}
          </CardContent>
          <CardFooter className="mt-(--card-spacing)">
            <Button type="submit" className="w-full" disabled={pending || !email || !password}>
              {pending ? "로그인 중…" : "로그인"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <p className="text-center text-muted-foreground">
        처음이신가요?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          회원가입
        </Link>
      </p>
    </AuthShell>
  )
}

/* ───────────── 확인 완료 / 오류 ───────────── */

export function WelcomeScreen() {
  const user = useAuthUser()
  return (
    <AuthShell title="가입 완료">
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <SuccessMark label="이메일 확인 완료" />
        <MobileScreenHeading className="text-center">이메일 확인이 끝났어요</MobileScreenHeading>
        {user && <p className="text-muted-foreground">{user.email}로 로그인했어요.</p>}
      </div>
      <Button asChild className="w-full">
        <Link href="/">관극 기록 시작하기</Link>
      </Button>
    </AuthShell>
  )
}

export function AuthErrorScreen() {
  const reason = (useSearchParams().get("reason") ?? "").toLowerCase()
  const expired = reason.includes("expired") || reason.includes("invalid")
  const otherBrowser = reason.includes("code verifier") || reason.includes("code_verifier")
  return (
    <AuthShell title="이메일 확인">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {otherBrowser ? "가입한 브라우저에서 열어 주세요" : "확인 링크를 열 수 없어요"}
          </CardTitle>
          <CardDescription className="leading-relaxed">
            {otherBrowser
              ? "이메일 확인은 끝났을 수 있어요. 로그인해 보고, 안 되면 확인 메일을 다시 받아 주세요."
              : expired
                ? "링크가 만료됐거나 이미 사용됐어요. 로그인해서 확인 메일을 다시 받아 주세요."
                : "잠시 후 다시 시도해 주세요."}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/login">로그인하기</Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthShell>
  )
}
