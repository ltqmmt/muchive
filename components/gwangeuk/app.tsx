"use client"

import { ArrowRight, Bookmark, CalendarDays, ChevronLeft, CircleUser, Compass, Eye, EyeOff, Heart, LogOut, Star, NotebookPen, PenLine, Plus, Trash2, X } from "lucide-react"
import Link from "next/link"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import { signOut, useAuthUser } from "@/components/gwangeuk/auth"
import { ClueField, type Clue } from "@/components/gwangeuk/clue-field"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  MobileAppShell,
  MobileListCard,
  MobileScreenHeading,
  MobileToolbarButton,
} from "@/components/ui/mobile-app-shell"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SuccessMark } from "@/components/ui/success-mark"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  addCustomEntry,
  countChars,
  countRecordedNumbers,
  deleteRecord,
  draftHasText,
  draftOf,
  removeCustomEntry,
  saveDraft,
  setDraftPerformance,
  setDraftText,
  startDraft,
  toggleBookmark,
  toggleLike,
  updateCustomEntry,
  useRecordStore,
  type StoreState,
} from "@/lib/record-store"
import {
  findPerformance,
  formatPerformance,
  pairLabel,
  pairShort,
  performanceForReview,
  castRoles,
  performancesOf,
  performancesOn,
  toIso,
  RUN,
  type Performance,
} from "@/lib/schedule"
import {
  formatDate,
  getShow,
  groupByAct,
  numberName,
  shows,
  TODAY,
  WHOLE_SHOW,
  type AudienceReview,
  type Show,
  type ShowRecord,
} from "@/lib/show-data"

type Sub = { name: "number"; showId: string; numberId: string } | { name: "review"; showId: string; reviewId: string }

const NavCtx = createContext<{
  openReview: (showId: string, reviewId: string) => void
  openNumber: (showId: string, numberId: string) => void
}>({ openReview: () => {}, openNumber: () => {} })

type Tab = "explore" | "records" | "bookmarks" | "account"
type View =
  | { name: "tabs" }
  | { name: "write"; showId: string }
  | { name: "result"; recordId: string; justSaved: boolean }

function bookmarkedFor(show: Show, numberId: string, bookmarks: string[]) {
  return bookmarks
    .map((id) => show.reviews.find((review) => review.id === id))
    .find((review): review is AudienceReview => review?.numberId === numberId)
}

function clueFor(show: Show, numberId: string, bookmarks: string[]): Clue | undefined {
  const saved = bookmarkedFor(show, numberId, bookmarks)
  return saved ? { kind: "bookmark", text: saved.body, author: saved.author } : undefined
}

function numberLabel(show: Show, numberId: string) {
  const number = show.numbers.find((n) => n.id === numberId)
  return number ? numberName(number) : "공연 전체"
}

function filledNumbers(show: Show, store: StoreState) {
  const draft = draftOf(store, show.id)
  return show.numbers.filter(
    (n) => (draft.texts[n.id] ?? "").trim() || draft.custom.some((e) => e.numberId === n.id && e.text.trim()),
  ).length
}

export function GwangeukApp() {
  const store = useRecordStore()
  const [tab, setTab] = useState<Tab>("explore")
  const [exploreShowId, setExploreShowId] = useState<string | null>(null)
  const [view, setView] = useState<View>({ name: "tabs" })
  const [stack, setStack] = useState<Sub[]>([])
  useEffect(() => {
    const onPop = () => setStack((st) => st.slice(0, -1))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  const push = (sub: Sub) => {
    window.history.pushState(null, "")
    setStack((st) => [...st, sub])
  }
  const nav = {
    openReview: (showId: string, reviewId: string) => push({ name: "review", showId, reviewId }),
    openNumber: (showId: string, numberId: string) => push({ name: "number", showId, numberId }),
  }
  const sub = stack[stack.length - 1]

  const openWrite = (showId: string) => setView({ name: "write", showId })
  const backToRecords = () => {
    setTab("records")
    setView({ name: "tabs" })
  }

  if (view.name === "write") {
    return (
      <WriteScreen
        show={getShow(view.showId)}
        store={store}
        onClose={() => setView({ name: "tabs" })}
        onSaved={(recordId) => setView({ name: "result", recordId, justSaved: true })}
      />
    )
  }

  if (view.name === "result") {
    const record = store.records.find((r) => r.id === view.recordId)
    if (record) {
      return <ResultScreen record={record} records={store.records} justSaved={view.justSaved} onBack={backToRecords} />
    }
  }

  const exploreShow = tab === "explore" && exploreShowId ? getShow(exploreShowId) : null

  return (
    <NavCtx.Provider value={nav}>
    {sub && <SubScreen sub={sub} store={store} />}
    <div hidden={!!sub}>
    <MobileAppShell
      title={exploreShow?.title}
      leading={
        exploreShow ? (
          <MobileToolbarButton aria-label="공연 목록" onClick={() => setExploreShowId(null)}>
            <ChevronLeft strokeWidth={2} />
          </MobileToolbarButton>
        ) : undefined
      }
      navigation={{
        "aria-label": "주요 메뉴",
        value: tab,
        onValueChange: (value) => setTab(value as Tab),
        items: [
          { value: "explore", label: "탐색", icon: <Compass strokeWidth={2} /> },
          { value: "records", label: "내 기록", icon: <NotebookPen strokeWidth={2} /> },
          {
            value: "bookmarks",
            label: "북마크함",
            icon: <Bookmark strokeWidth={2} />,
            badge: store.bookmarks.length || undefined,
          },
          { value: "account", label: "내 정보", icon: <CircleUser strokeWidth={2} /> },
        ],
      }}
    >
      {tab === "explore" &&
        (exploreShow ? (
          <ShowDetailScreen
            key={exploreShow.id}
            show={exploreShow}
            store={store}
            onWrite={() => openWrite(exploreShow.id)}
          />
        ) : (
          <ShowListScreen store={store} onOpen={setExploreShowId} />
        ))}
      {tab === "records" && (
        <RecordsScreen
          store={store}
          onExplore={() => setTab("explore")}
          onOpen={(recordId) => setView({ name: "result", recordId, justSaved: false })}
        />
      )}
      {tab === "account" && <AccountScreen />}
      {tab === "bookmarks" && (
        <BookmarksScreen
          store={store}
          onExplore={() => {
            setExploreShowId(null)
            setTab("explore")
          }}
        />
      )}
    </MobileAppShell>
    </div>
    </NavCtx.Provider>
  )
}

/* ───────────── 후기·넘버 상세 페이지 ───────────── */

function SubScreen({ sub, store }: { sub: Sub; store: StoreState }) {
  const nav = useContext(NavCtx)
  const show = getShow(sub.showId)
  const review = sub.name === "review" ? show.reviews.find((r) => r.id === sub.reviewId) : undefined
  const [focusId, setFocusId] = useState(review?.id)
  const thread = review ? threadOf(show, review) : []
  const isThread = thread.length > 1
  const number = show.numbers.find((n) => n.id === (review ? review.numberId : sub.name === "number" ? sub.numberId : ""))
  const list = number ? sortReviews(show.reviews.filter((r) => r.numberId === number.id), "likes", store) : []

  // 선택한 글이 화면 가운데 오도록 열고, 위아래로 앞뒤 글을 스크롤해서 본다.
  useEffect(() => {
    if (isThread && focusId) scrollToId(`thread-${focusId}`, { center: true, instant: true })
  }, [isThread, focusId])

  const rows = isThread ? show.numbers : number ? [number] : []

  return (
    <MobileAppShell
      title={sub.name === "review" ? "관극 후기" : "전체 후기"}
      leading={
        <MobileToolbarButton aria-label="뒤로" onClick={() => window.history.back()}>
          <ChevronLeft strokeWidth={2} />
        </MobileToolbarButton>
      }
    >
      <div className="flex flex-col gap-4 pt-2 pb-6 break-keep">
        {review && (
          <div className="flex flex-col gap-1 px-1">
            <p className="text-muted-foreground">{show.title}</p>
            <h1 className="text-xl font-semibold">
              {review.author}님의 {review.watchedOn} 관극 후기
            </h1>
            {isThread && <p className="text-muted-foreground">넘버 {thread.length}개로 이어지는 한 편의 후기예요. 위아래로 넘겨 보세요.</p>}
          </div>
        )}
        {sub.name === "number" && number && (
          <div className="flex flex-col gap-1 px-1">
            <p className="text-muted-foreground">{show.title}</p>
            <h1 className="text-xl font-semibold">{numberName(number)}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{number.scene}</p>
          </div>
        )}
        {review && (
          <ol className="flex flex-col">
            {rows.map((n, i) => {
              const r = thread.find((t) => t.numberId === n.id) ?? (isThread ? undefined : review)
              const current = r?.id === focusId
              return (
                <li key={n.id} className={`relative flex gap-3 ${r ? "pb-4" : "pb-2"}`}>
                  {i < rows.length - 1 && <span className="absolute top-4 bottom-0 left-[5px] w-px bg-border" aria-hidden />}
                  <span
                    className={`mt-1.5 shrink-0 rounded-full ${
                      r ? "size-[11px] bg-primary" : "size-[11px] border-2 border-border bg-background"
                    }`}
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className={r ? "font-semibold" : "text-sm text-muted-foreground"}>{numberName(n)}</p>
                    {r && (
                      <div id={`thread-${r.id}`} className={current ? "rounded-xl ring-2 ring-primary" : undefined}>
                        <ReviewCard
                          review={r}
                          show={show}
                          store={store}
                          plain={current || !isThread}
                          onBody={isThread ? () => setFocusId(r.id) : undefined}
                        />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        {review && number && (
          <Button variant="outline" onClick={() => nav.openNumber(show.id, number.id)}>
            {numberName(number)} 전체 후기 보러가기
            <ArrowRight data-icon="inline-end" strokeWidth={2} aria-hidden />
          </Button>
        )}
        {sub.name === "number" && (
          <div className="flex flex-col">
            {list.map((r) => (
              <ReviewCard key={r.id} review={r} show={show} store={store} />
            ))}
          </div>
        )}
      </div>
    </MobileAppShell>
  )
}

/* ───────────── 탐색: 공연 목록 ───────────── */

function ShowListScreen({ store, onOpen }: { store: StoreState; onOpen: (showId: string) => void }) {
  return (
    <div className="flex flex-col gap-6 pt-4 pb-6 break-keep">
      <MobileScreenHeading>탐색</MobileScreenHeading>
      <ul className="flex flex-col gap-3">
        {shows.map((show) => {
          const saved = show.reviews.filter((r) => store.bookmarks.includes(r.id)).length
          const inProgress = draftHasText(draftOf(store, show.id))
          return (
            <li key={show.id}>
              <MobileListCard
                href={`#${show.id}`}
                onClick={(event) => {
                  event.preventDefault()
                  onOpen(show.id)
                }}
              >
                <span className="flex flex-col gap-1">
                  <span className="text-xl leading-snug font-bold">{show.title}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {formatDate(RUN.start)} ~ {formatDate(RUN.end)} · {show.venue}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    후기 {show.reviews.length}개{saved > 0 && ` · 북마크 ${saved}개`}
                    {inProgress && " · 작성 중"}
                  </span>
                  <span className="mt-1 line-clamp-2 text-base leading-relaxed font-normal">
                    “{[...show.reviews].sort((a, b) => b.bookmarks - a.bookmarks)[0]?.body}”
                  </span>
                </span>
              </MobileListCard>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ───────────── 탐색: 공연 상세 ───────────── */

function ActHeading({ act }: { act: 1 | 2 }) {
  return <h2 className="px-1 text-lg font-bold">{act}막</h2>
}

type SortKey = "number" | "likes" | "bookmarks" | "recent"

function reviewCounts(review: AudienceReview, store: StoreState) {
  return {
    liked: store.likes.includes(review.id),
    bookmarked: store.bookmarks.includes(review.id),
    likes: review.likes + (store.likes.includes(review.id) ? 1 : 0),
    bookmarks: review.bookmarks + (store.bookmarks.includes(review.id) ? 1 : 0),
  }
}

/**
 * likes/bookmarks: 많은 순, recent: 최근 관람일 순(같은 날이면 나중에 등록된 후기 먼저),
 * number: 넘버 안에서는 좋아요 많은 순.
 */
function sortReviews(list: AudienceReview[], key: SortKey, store: StoreState) {
  const watched = (r: AudienceReview) => r.watchedOn.replace(".", "")
  const order = new Map(list.map((r, i) => [r.id, i]))
  return [...list].sort((a, b) => {
    if (key === "recent")
      return watched(b).localeCompare(watched(a)) || order.get(b.id)! - order.get(a.id)!
    const field = key === "bookmarks" ? "bookmarks" : "likes"
    return reviewCounts(b, store)[field] - reviewCounts(a, store)[field]
  })
}

function ReviewCard({
  review,
  show,
  store,
  showNumber,
  hidden,
  plain,
  onBody,
}: {
  /** 본문을 눌렀을 때의 동작. 없으면 후기 페이지로 이동한다 */
  onBody?: () => void
  review: AudienceReview
  show: Show
  store: StoreState
  /** 후기 상세 페이지 안에서는 본문을 링크로 만들지 않는다 */
  plain?: boolean
  /** 넘버 구분 없이 나열할 때 어느 넘버의 후기인지 보여준다 */
  showNumber?: boolean
  /** 스포일러 가리기 */
  hidden?: boolean
}) {
  const { liked, bookmarked, likes, bookmarks } = reviewCounts(review, store)
  const performance = performanceForReview(show, review.watchedOn)
  const number = showNumber ? show.numbers.find((n) => n.id === review.numberId) : undefined
  const [peek, setPeek] = useState(false)
  const nav = useContext(NavCtx)
  const threadCount = threadOf(show, review).length
  const open = () => (onBody ? onBody() : nav.openReview(show.id, review.id))
  const action =
    "flex h-9 items-center gap-1.5 rounded-full px-2 text-sm tabular-nums transition-colors hover:bg-muted active:scale-95 motion-reduce:transition-none"

  return (
    <article id={`review-${review.id}`} className="flex gap-3 border-b border-border px-1 py-4">
      <div
        className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-base font-bold text-muted-foreground"
        aria-hidden
      >
        {review.author.slice(0, 1)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-bold">{review.author}</span>
          <span className="shrink-0 text-sm text-muted-foreground">· {review.watchedOn} 관람</span>
        </div>
        {(performance || number) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {performance && <span>{pairShort(performance)}</span>}
            {number && <Badge variant="secondary">{numberName(number)}</Badge>}
          </div>
        )}
        {hidden && !peek ? (
          <button type="button" onClick={() => setPeek(true)} className="mt-2 text-left leading-relaxed text-muted-foreground">
            <span className="blur-sm select-none" aria-hidden>{review.body}</span>
            <span className="sr-only">스포일러 가림. 눌러서 보기</span>
          </button>
        ) : plain ? (
          <p className="mt-2 leading-relaxed">{review.body}</p>
        ) : (
          <button
            type="button"
            aria-label={`${review.author}님의 후기 전문 보기`}
            onClick={open}
            className="mt-2 text-left leading-relaxed"
          >
            {review.body}
          </button>
        )}
        {!plain && !onBody && threadCount > 1 && (
          <button type="button" onClick={open} className="mt-2 self-start text-sm font-medium text-primary">
            관극 후기 이어 읽기 · 넘버 {threadCount}개 →
          </button>
        )}
        <div className="mt-2 -ml-2 flex items-center gap-4">
          <button
            type="button"
            aria-pressed={liked}
            aria-label={liked ? `${review.author}님의 후기 좋아요 취소` : `${review.author}님의 후기 좋아요`}
            onClick={() => toggleLike(review.id)}
            className={`${action} ${liked ? "text-rose-500" : "text-muted-foreground"}`}
          >
            <Heart className="size-[18px]" strokeWidth={2} fill={liked ? "currentColor" : "none"} aria-hidden />
            {likes.toLocaleString("ko-KR")}
          </button>
          <button
            type="button"
            aria-pressed={bookmarked}
            aria-label={bookmarked ? `${review.author}님의 후기 북마크 해제` : `${review.author}님의 후기 북마크`}
            onClick={() => toggleBookmark(review.id)}
            className={`${action} ${bookmarked ? "text-primary" : "text-muted-foreground"}`}
          >
            <Bookmark className="size-[18px]" strokeWidth={2} fill={bookmarked ? "currentColor" : "none"} aria-hidden />
            {bookmarks.toLocaleString("ko-KR")}
          </button>
        </div>
      </div>
    </article>
  )
}

function ShowHeader({
  show,
  store,
  picked,
  onPick,
  onReset,
  resultCount,
  onWrite,
  wishCount,
  onTop,
}: {
  show: Show
  store: StoreState
  picked: string[]
  onPick: (key: string) => void
  onReset: () => void
  resultCount: number
  onWrite: () => void
  wishCount: number
  onTop: (reviewId: string) => void
}) {
  const roles = castRoles[show.id] ?? []
  const top = [...show.reviews].sort((a, b) => b.bookmarks - a.bookmarks)[0]
  const topNumber = top && show.numbers.find((n) => n.id === top.numberId)
  const draft = draftOf(store, show.id)
  const hasDraft = draftHasText(draft)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl leading-tight font-bold">{show.title}</CardTitle>
        <CardDescription className="text-sm leading-normal">
          {show.venue} · 후기 {show.reviews.length}개
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {top && topNumber && (
          <button
            type="button"
            onClick={() => onTop(top.id)}
            className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-left"
          >
            <span className="text-xs font-medium text-muted-foreground">북마크가 가장 많은 한 줄 · {numberName(topNumber)}</span>
            <span className="text-lg leading-snug font-medium">“{top.body}”</span>
            <span className="text-sm font-medium text-primary">원문 보기 →</span>
          </button>
        )}
        {roles.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">배우로 후기 골라 보기</p>
              {picked.length > 0 && (
                <Button variant="ghost" size="sm" onClick={onReset}>
                  초기화
                </Button>
              )}
            </div>
            {roles.map((r) => (
              <div key={r.role} className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">{r.role}</p>
                <div className="flex flex-wrap gap-2">
                  {r.actors.map((actor) => {
                    const key = `${r.role}|${actor}`
                    const on = picked.includes(key)
                    return (
                      <Button
                        key={key}
                        size="sm"
                        variant={on ? "default" : "outline"}
                        aria-pressed={on}
                        onClick={() => onPick(key)}
                      >
                        {actor}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              {picked.length > 0 ? `선택한 배우로 본 후기 ${resultCount}개` : "배우를 누르면 그 배우로 본 후기만 모아 볼 수 있어요."}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        {wishCount > 0 && (
          <p className="text-muted-foreground">기대 넘버 {wishCount}개를 담았어요. 기록할 때 다시 보여드려요.</p>
        )}
        <Button className="w-full" onClick={onWrite}>
          <PenLine data-icon="inline-start" strokeWidth={2} aria-hidden />
          {hasDraft
            ? `이어서 기록하기 (${filledNumbers(show, store)}/${show.numbers.length})`
            : "이 공연 기록하기"}
        </Button>
      </CardFooter>
    </Card>
  )
}

const REVIEW_PREVIEW = 2

/** 선택한 배우들로 본 후기인지. 같은 역할 안에서는 하나라도 맞으면 되고, 역할이 다르면 모두 맞아야 한다. */
function matchesCast(show: Show, review: AudienceReview, picked: string[]) {
  if (picked.length === 0) return true
  const p = performanceForReview(show, review.watchedOn)
  if (!p) return false
  const roles = new Set(picked.map((k) => k.split("|")[0]))
  return [...roles].every((role) =>
    p.pair.some((x) => x.role === role && picked.includes(`${role}|${x.actor}`)),
  )
}

/** 관람 전에 "기대되는 넘버"를 고르는 기기 내 저장소 */
function loadWishes(showId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`gw-wish-${showId}`) ?? "[]")
  } catch {
    return []
  }
}

function useWishes(showId: string) {
  const [wishes, setWishes] = useState<string[]>([])
  // 서버 렌더링과 맞추기 위해 마운트 뒤에 브라우저 저장값을 읽는다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setWishes(loadWishes(showId)), [showId])
  const toggle = (id: string) => {
    const next = wishes.includes(id) ? wishes.filter((w) => w !== id) : [...wishes, id]
    setWishes(next)
    try {
      localStorage.setItem(`gw-wish-${showId}`, JSON.stringify(next))
    } catch {}
  }
  return [wishes, toggle] as const
}

/**
 * 앱 셸은 바깥이 overflow:hidden이라 scrollIntoView를 쓰면 셸 전체가 밀려 화면이 어긋난다.
 * 가장 가까운 스크롤 영역만 직접 움직인다.
 */
function scrollToId(id: string, opts: { center?: boolean; instant?: boolean } = {}) {
  const el = document.getElementById(id)
  if (!el) return
  let box: HTMLElement | null = el.parentElement
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
  if (!box) return
  const pad = parseFloat(getComputedStyle(box).scrollPaddingTop) || 0
  let top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - pad
  if (opts.center) top -= (box.clientHeight - el.offsetHeight) / 2 - pad
  box.scrollTo({ top, behavior: opts.instant ? "instant" : "smooth" })
}

/** 같은 관객이 같은 날 본 관극 후기(넘버 순서). 한 편의 관극 후기를 이루는 스레드다. */
function threadOf(show: Show, review: AudienceReview) {
  const order = new Map(show.numbers.map((n, i) => [n.id, i]))
  return show.reviews
    .filter((r) => r.author === review.author && r.watchedOn === review.watchedOn)
    .sort((a, b) => order.get(a.numberId)! - order.get(b.numberId)!)
}

/** 1막/2막 넘버를 점으로 보여주는 하이라이트 지도. 후기가 많을수록 크게 보인다. */
function NumberMap({ show, wishes }: { show: Show; wishes: string[] }) {
  const counts = new Map<string, number>()
  show.reviews.forEach((r) => counts.set(r.numberId, (counts.get(r.numberId) ?? 0) + 1))
  const max = Math.max(1, ...counts.values())
  return (
    <div className="flex flex-col gap-2 px-1">
      <p className="text-xs text-muted-foreground">점이 클수록 관객들이 많이 이야기한 넘버예요. 눌러서 이동해 보세요.</p>
      <div className="flex flex-wrap items-end gap-x-2 gap-y-3" role="list">
        {groupByAct(show.numbers).map(({ act, numbers }) => (
          <div key={act ?? "all"} className="flex flex-wrap items-end gap-1" role="listitem">
            {act && <span className="mr-1 text-sm text-muted-foreground">{act}막</span>}
            {numbers.map((n) => {
              const c = counts.get(n.id) ?? 0
              const size = 12 + Math.round((c / max) * 18)
              return (
                <button
                  key={n.id}
                  type="button"
                  disabled={c === 0}
                  aria-label={`${numberName(n)}, 후기 ${c}개${wishes.includes(n.id) ? ", 기대 넘버" : ""}`}
                  onClick={() => scrollToId(`explore-${n.id}`)}
                  style={{ width: size, height: size }}
                  className={`rounded-full bg-primary transition-opacity disabled:opacity-20 ${
                    wishes.includes(n.id) ? "ring-2 ring-offset-2 ring-primary" : "opacity-60 hover:opacity-100"
                  }`}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

const FLAT_PAGE = 10

/** 넘버 구분 없이 정렬 기준대로 모든 후기를 나열한다. */
function FlatReviews({ show, store, sort, hidden }: { show: Show; store: StoreState; sort: SortKey; hidden: boolean }) {
  const [count, setCount] = useState(FLAT_PAGE)
  const list = sortReviews(show.reviews, sort, store)
  const rest = list.length - count
  return (
    <ol className="flex flex-col" aria-label="후기 목록">
      {list.slice(0, count).map((review) => (
        <li key={review.id}>
          <ReviewCard review={review} show={show} store={store} showNumber hidden={hidden} />
        </li>
      ))}
      {rest > 0 && (
        <li className="flex justify-center">
          <Button variant="ghost" onClick={() => setCount(count + FLAT_PAGE)}>
            후기 {Math.min(rest, FLAT_PAGE)}개 더 보기 ({count}/{list.length})
          </Button>
        </li>
      )}
    </ol>
  )
}

function NumberReviews({
  number,
  show,
  store,
  hidden,
  wished,
  onWish,
}: {
  number: Show["numbers"][number]
  show: Show
  store: StoreState
  hidden: boolean
  wished: boolean
  onWish: () => void
}) {
  const list = sortReviews(
    show.reviews.filter((review) => review.numberId === number.id),
    "likes",
    store,
  )
  const nav = useContext(NavCtx)
  const visible = list.slice(0, REVIEW_PREVIEW)
  const more = list.length - REVIEW_PREVIEW
  return (
    <section aria-labelledby={`explore-${number.id}`} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="flex flex-col gap-1">
          <h3 id={`explore-${number.id}`} className="scroll-mt-4 text-base font-semibold">
            {numberName(number)}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{number.scene}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={wished}
          aria-label={wished ? `${numberName(number)} 기대 넘버 해제` : `${numberName(number)} 기대 넘버로 담기`}
          onClick={onWish}
          className={wished ? "text-primary" : "text-muted-foreground"}
        >
          <Star strokeWidth={2} fill={wished ? "currentColor" : "none"} aria-hidden />
        </Button>
      </div>
      <div className="flex flex-col">
        {visible.map((review) => (
          <ReviewCard key={review.id} review={review} show={show} store={store} hidden={hidden} />
        ))}
      </div>
      {more > 0 && (
        <Button variant="outline" className="self-start" onClick={() => nav.openNumber(show.id, number.id)}>
          전체 후기 보러가기 ({list.length})
          <ArrowRight data-icon="inline-end" strokeWidth={2} aria-hidden />
        </Button>
      )}
    </section>
  )
}

function ShowDetailScreen({
  show,
  store,
  onWrite,
}: {
  show: Show
  store: StoreState
  onWrite: () => void
}) {
  const nav = useContext(NavCtx)
  const [sort, setSort] = useState<SortKey>("number")
  const [picked, setPicked] = useState<string[]>([])
  const [actTab, setActTab] = useState<"all" | "1" | "2">("all")
  const [spoiler, setSpoiler] = useState(false)
  const hasIntermission = show.numbers.some((n) => n.act)
  const [wishes, toggleWish] = useWishes(show.id)
  const actNumbers = show.numbers.filter((n) => actTab === "all" || String(n.act) === actTab)
  const actIds = new Set(actNumbers.map((n) => n.id))
  const view: Show = {
    ...show,
    reviews: show.reviews.filter((r) => actIds.has(r.numberId) && matchesCast(show, r, picked)),
  }
  const numbers = picked.length > 0 ? actNumbers.filter((n) => view.reviews.some((r) => r.numberId === n.id)) : actNumbers

  return (
    <div className="flex flex-col gap-6 pt-2 pb-6 break-keep">
      <ShowHeader
        show={show}
        store={store}
        picked={picked}
        onPick={(key) => setPicked(picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key])}
        onReset={() => setPicked([])}
        resultCount={view.reviews.length}
        onWrite={onWrite}
        wishCount={wishes.length}
        onTop={(id) => nav.openReview(show.id, id)}
      />

      {hasIntermission && (
        <div role="group" aria-label="막 선택" className="flex gap-4 px-1">
          {(["all", "1", "2"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={actTab === v}
              onClick={() => setActTab(v)}
              className={`py-1 ${actTab === v ? "border-b-2 border-primary font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {v === "all" ? "전체" : `${v}막`}
            </button>
          ))}
        </div>
      )}

      <NumberMap show={view} wishes={wishes} />

      <div className="flex flex-col gap-3 px-1">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">관객 후기</h2>
          <Button variant="ghost" size="sm" aria-pressed={spoiler} onClick={() => setSpoiler(!spoiler)}>
            {spoiler ? <EyeOff data-icon="inline-start" strokeWidth={2} aria-hidden /> : <Eye data-icon="inline-start" strokeWidth={2} aria-hidden />}
            {spoiler ? "스포일러 가림" : "스포일러 가리기"}
          </Button>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={sort}
          onValueChange={(value) => value && setSort(value as SortKey)}
          aria-label="후기 정렬"
          className="flex-wrap"
        >
          <ToggleGroupItem value="number">넘버순</ToggleGroupItem>
          <ToggleGroupItem value="likes">좋아요순</ToggleGroupItem>
          <ToggleGroupItem value="bookmarks">북마크순</ToggleGroupItem>
          <ToggleGroupItem value="recent">최신순</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {sort === "number" ? (
        groupByAct(numbers).map(({ act, numbers }) => (
          <div key={act ?? "all"} className="flex flex-col gap-6">
            {act && actTab === "all" && <ActHeading act={act} />}
            {numbers.map((number) => (
              <NumberReviews
                key={number.id}
                number={number}
                show={view}
                store={store}
                hidden={spoiler}
                wished={wishes.includes(number.id)}
                onWish={() => toggleWish(number.id)}
              />
            ))}
          </div>
        ))
      ) : (
        <FlatReviews key={sort + picked.join() + actTab} show={view} store={store} sort={sort} hidden={spoiler} />
      )}
    </div>
  )
}

/* ───────────── 작성 (Aha) ───────────── */

/** 관람 날짜 선택. 기본은 비어 있고, 고르면 그 회차의 출연진이 자동으로 정해진다. */
function DateBlock({ show, performance }: { show: Show; performance?: Performance }) {
  const [open, setOpen] = useState(false)
  const playDates = new Set(performancesOf(show).map((p) => p.date))
  const sameDay = performance ? performancesOn(show, performance.date) : []
  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" className="justify-start" aria-expanded={open} onClick={() => setOpen(!open)}>
        <CalendarDays data-icon="inline-start" strokeWidth={2} aria-hidden />
        {performance ? formatPerformance(performance) : "공연 날짜 선택"}
      </Button>
      {open && (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex justify-center">
            <Calendar
              selected={performance ? new Date(`${performance.date}T00:00:00`) : undefined}
              today={new Date(`${TODAY}T00:00:00`)}
              disabled={(date) => !playDates.has(toIso(date)) || toIso(date) > TODAY}
              onSelect={(date) => {
                if (!date) return
                const list = performancesOn(show, toIso(date))
                if (!list.length) return
                setDraftPerformance(show.id, list[list.length - 1].id)
                if (list.length === 1) setOpen(false)
              }}
            />
          </div>
          {sameDay.length > 1 && (
            <ToggleGroup
              type="single"
              variant="outline"
              value={performance?.id}
              onValueChange={(id) => {
                if (id) {
                  setDraftPerformance(show.id, id)
                  setOpen(false)
                }
              }}
              aria-label="공연 시간"
            >
              {sameDay.map((p) => (
                <ToggleGroupItem key={p.id} value={p.id}>
                  {p.time}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
      )}
      {performance && performance.pair.length > 0 ? (
        <p className="px-1 text-muted-foreground">이 회차 출연진 · {pairLabel(performance)}</p>
      ) : (
        !performance && (
          <p className="px-1 text-muted-foreground">날짜는 나중에 골라도 돼요. 먼저 기억나는 대로 적어 두세요.</p>
        )
      )}
    </div>
  )
}

type WriteTab = "write" | "numbers"

function WriteScreen({
  show,
  store,
  onClose,
  onSaved,
}: {
  show: Show
  store: StoreState
  onClose: () => void
  onSaved: (recordId: string) => void
}) {
  const draft = draftOf(store, show.id)
  const performance = findPerformance(show, draft.performanceId)
  const filled = filledNumbers(show, store)
  const canSave = draftHasText(draft)
  const bookmarkedNumbers = show.numbers.filter((n) => bookmarkedFor(show, n.id, store.bookmarks))
  // 북마크한 후기가 없으면 모든 넘버를 단서 없이 빈 칸으로 보여준다.
  const clueNumbers = bookmarkedNumbers.length > 0 ? bookmarkedNumbers : show.numbers
  const [wishes] = useWishes(show.id)
  const wishNames = show.numbers.filter((n) => wishes.includes(n.id)).map(numberName)
  const [writeTab, setWriteTab] = useState<WriteTab>("write")
  const [focusId, setFocusId] = useState<string | null>(null)

  return (
    <MobileAppShell
      title="오늘의 기록"
      leading={
        <MobileToolbarButton aria-label="닫기" onClick={onClose}>
          <X strokeWidth={2} />
        </MobileToolbarButton>
      }
      bottomAction={
        <div className="flex w-full flex-col gap-2">
          {canSave && !performance && (
            <p className="text-center text-muted-foreground">공연 날짜를 선택하면 기록으로 저장할 수 있어요.</p>
          )}
          <div className="flex gap-2">
            <Button size="md" variant="outline" className="flex-1" disabled={!canSave} onClick={onClose}>
              임시저장
            </Button>
            <Button
              size="md"
              className="flex-1"
              disabled={!canSave || !performance}
              onClick={() => onSaved(saveDraft(show.id, (id) => clueFor(show, id, store.bookmarks) ? "bookmark" : "own"))}
            >
              기록 저장
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pt-2 pb-6 break-keep">
        {wishNames.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
            <p className="font-semibold">관람 전에 기대했던 넘버</p>
            <p className="text-muted-foreground">{wishNames.join(" · ")}</p>
            <p className="text-muted-foreground">기대와 실제 감상이 어땠는지 적어 보세요.</p>
          </div>
        )}
        <div className="flex flex-col gap-3 px-1">
          <h1 className="text-xl font-semibold">{show.title}</h1>
          <DateBlock show={show} performance={performance} />
          <Progress
            value={(filled / show.numbers.length) * 100}
            aria-label={`${show.numbers.length}개 넘버 중 ${filled}개 기록`}
          />
        </div>

        <Tabs value={writeTab} onValueChange={(value) => setWriteTab(value as WriteTab)} className="gap-6">
          <TabsList sizing="fill">
            <TabsTrigger value="write">북마크한 후기</TabsTrigger>
            <TabsTrigger value="numbers">실제 목차/넘버</TabsTrigger>
          </TabsList>

          <TabsContent value="write" className="flex flex-col gap-6">
            {clueNumbers.map((number) => (
              <Card key={number.id}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {numberName(number)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ClueField
                    label={`${number.title} 기록`}
                    clue={clueFor(show, number.id, store.bookmarks)}
                    value={draft.texts[number.id] ?? ""}
                    onFocus={() => startDraft(show.id)}
                    onChange={(text) => setDraftText(show.id, number.id, text)}
                  />
                </CardContent>
              </Card>
            ))}

            {draft.custom.map((entry, index) => (
              <Card key={entry.id}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">내 감상 {index + 1}</CardTitle>
                  <CardAction>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`내 감상 ${index + 1} 삭제`}
                      className="text-muted-foreground"
                      onClick={() => removeCustomEntry(show.id, entry.id)}
                    >
                      <Trash2 strokeWidth={2} aria-hidden />
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Select
                    value={entry.numberId}
                    onValueChange={(numberId) => updateCustomEntry(show.id, entry.id, { numberId })}
                  >
                    <SelectTrigger className="w-full" aria-label={`내 감상 ${index + 1}의 넘버`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WHOLE_SHOW}>공연 전체</SelectItem>
                      {show.numbers.map((number) => (
                        <SelectItem key={number.id} value={number.id}>
                          {numberName(number)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    aria-label={`내 감상 ${index + 1}`}
                    autoFocus={entry.id === focusId}
                    value={entry.text}
                    onChange={(event) => updateCustomEntry(show.id, entry.id, { text: event.target.value })}
                    className="min-h-32 resize-none leading-relaxed"
                  />
                </CardContent>
              </Card>
            ))}

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setFocusId(addCustomEntry(show.id, WHOLE_SHOW))}
            >
              <Plus data-icon="inline-start" strokeWidth={2} aria-hidden />
              직접 작성하기
            </Button>
          </TabsContent>

          <TabsContent value="numbers" className="flex flex-col gap-6">
            {groupByAct(show.numbers).map(({ act, numbers }) => (
              <section key={act ?? "all"} className="flex flex-col gap-3">
                {act && <ActHeading act={act} />}
                <Card>
                  <CardContent>
                    <ol className="flex flex-col gap-4">
                      {numbers.map((number, index) => (
                        <li key={number.id} className="flex flex-col gap-4">
                          {index > 0 && <Separator />}
                          <div className="flex flex-col gap-1">
                            <h3 className="text-base font-semibold">{numberName(number)}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">{number.scene}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </section>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </MobileAppShell>
  )
}

/* ───────────── 기록 삭제 확인 ───────────── */

function DeleteRecordDialog({
  record,
  onDeleted,
  children,
}: {
  record: ShowRecord
  onDeleted?: () => void
  children: ReactNode
}) {
  const show = getShow(record.showId)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>기록을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {show.title} · {formatDate(record.date)} 기록이 삭제되고 되돌릴 수 없어요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              deleteRecord(record.id)
              onDeleted?.()
            }}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ───────────── 결과 ───────────── */

function previousRecord(record: ShowRecord, records: ShowRecord[]) {
  return records
    .filter((r) => r.id !== record.id && r.showId === record.showId && r.date < record.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

function ResultScreen({
  record,
  records,
  justSaved,
  onBack,
}: {
  record: ShowRecord
  records: ShowRecord[]
  justSaved: boolean
  onBack: () => void
}) {
  const show = getShow(record.showId)
  const chars = countChars(record)
  const prev = previousRecord(record, records)
  const prevChars = prev ? countChars(prev) : 0
  const has = (r: ShowRecord | undefined, id: string) => r?.entries.some((e) => e.numberId === id) ?? false
  const compared = [...show.numbers.map((n) => n.id), WHOLE_SHOW].filter((id) => has(record, id) || has(prev, id))
  const textsOf = (r: ShowRecord | undefined, id: string) =>
    r?.entries.filter((e) => e.numberId === id).map((e) => e.text) ?? []

  return (
    <MobileAppShell
      title={formatDate(record.date)}
      leading={
        <MobileToolbarButton aria-label="내 기록으로" onClick={onBack}>
          <X strokeWidth={2} />
        </MobileToolbarButton>
      }
      trailing={
        <DeleteRecordDialog record={record} onDeleted={onBack}>
          <MobileToolbarButton aria-label="기록 삭제">
            <Trash2 strokeWidth={2} />
          </MobileToolbarButton>
        </DeleteRecordDialog>
      }
    >
      <div className="flex flex-col gap-6 pt-2 pb-8 break-keep">
        {justSaved && (
          <div className="flex flex-col items-center gap-4 pt-4 text-center">
            <SuccessMark label="저장 완료" />
            <MobileScreenHeading className="text-center">
              {record.date === TODAY ? "오늘의 순간을 남겼어요" : "그날의 순간을 남겼어요"}
            </MobileScreenHeading>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {show.title} · {formatDate(record.date)}
              {record.time && ` ${record.time}`}
            </CardTitle>
            {record.cast && <CardDescription>{record.cast}</CardDescription>}
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Stat label="기록한 넘버" value={`${countRecordedNumbers(record)}/${show.numbers.length}`} />
              <Stat label="글자 수" value={chars.toLocaleString("ko-KR")} />
              <Stat label="작성 시간" value={formatDuration(record.durationSec)} />
            </dl>
          </CardContent>
          {prev && (
            <CardFooter className="pb-(--card-spacing)">
              <p className="text-muted-foreground">
                {formatDate(prev.date)} 기록보다{" "}
                {chars >= prevChars ? `${chars - prevChars}자 더` : `${prevChars - chars}자 적게`} 남겼어요.
              </p>
            </CardFooter>
          )}
        </Card>

        <section aria-labelledby="compare-heading" className="flex flex-col gap-3">
          <h2 id="compare-heading" className="px-1 text-lg font-semibold">
            {prev ? `${formatDate(prev.date)} 회차와 비교` : "오늘의 감상"}
          </h2>
          {compared.map((id) => (
            <Card key={id} size="sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">{numberLabel(show, id)}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Entry label={formatDate(record.date)} texts={textsOf(record, id)} current />
                {prev && (
                  <>
                    <Separator />
                    <Entry label={formatDate(prev.date)} texts={textsOf(prev, id)} />
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </section>

        <Button variant="tertiary" className="w-full" onClick={onBack}>
          내 기록 보기
          <ArrowRight data-icon="inline-end" strokeWidth={2} aria-hidden />
        </Button>
      </div>
    </MobileAppShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function Entry({ label, texts, current }: { label: string; texts: string[]; current?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Badge variant={current ? "default" : "secondary"}>{label}</Badge>
      </div>
      {texts.length === 0 ? (
        <p className="text-muted-foreground">기록 없음</p>
      ) : (
        texts.map((text, i) => (
          <p key={i} className="leading-relaxed whitespace-pre-line">
            {text}
          </p>
        ))
      )}
    </div>
  )
}

/* ───────────── 내 기록 ───────────── */

function RecordsScreen({
  store,
  onExplore,
  onOpen,
}: {
  store: StoreState
  onExplore: () => void
  onOpen: (recordId: string) => void
}) {
  const records = [...store.records].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  return (
    <div className="flex flex-col gap-6 pt-4 pb-6 break-keep">
      <MobileScreenHeading>내 기록</MobileScreenHeading>
      {records.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">아직 남긴 기록이 없어요</CardTitle>
            <CardDescription className="leading-relaxed">
              탐색에서 공연을 고르고 오늘 공연을 기록해 보세요.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={onExplore}>
              공연 둘러보기
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((record) => {
            const show = getShow(record.showId)
            return (
              <Card key={record.id} size="sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {show.title} · {formatDate(record.date)}
                    {record.time && ` ${record.time}`}
                  </CardTitle>
                  <CardDescription>
                    {record.cast && (
                      <>
                        {record.cast}
                        <br />
                      </>
                    )}
                    넘버 {countRecordedNumbers(record)}개 · {countChars(record).toLocaleString("ko-KR")}자
                  </CardDescription>
                  <CardAction>
                    <DeleteRecordDialog record={record}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        aria-label={`${show.title} ${formatDate(record.date)} 기록 삭제`}
                      >
                        <Trash2 strokeWidth={2} aria-hidden />
                      </Button>
                    </DeleteRecordDialog>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 leading-relaxed">{record.entries[0]?.text}</p>
                </CardContent>
                <CardFooter>
                  <Button variant="tertiary" className="w-full" onClick={() => onOpen(record.id)}>
                    감상 비교하기
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ───────────── 북마크함 ───────────── */

function BookmarksScreen({ store, onExplore }: { store: StoreState; onExplore: () => void }) {
  const groups = shows
    .map((show) => ({
      show,
      saved: show.reviews.filter((review) => store.bookmarks.includes(review.id)),
    }))
    .filter((group) => group.saved.length > 0)

  return (
    <div className="flex flex-col gap-6 pt-4 pb-6 break-keep">
      <MobileScreenHeading>북마크함</MobileScreenHeading>
      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">아직 북마크한 후기가 없어요</CardTitle>
            <CardDescription className="leading-relaxed">
              공연 전에 다른 관객의 후기를 북마크하면, 기록할 때 해당 넘버에 단서로 보여요.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={onExplore}>
              후기 둘러보기
            </Button>
          </CardFooter>
        </Card>
      ) : (
        groups.map(({ show, saved }) => (
          <section key={show.id} aria-labelledby={`bm-${show.id}`} className="flex flex-col gap-4">
            <h2 id={`bm-${show.id}`} className="px-1 text-xl font-semibold">
              {show.title}
            </h2>
            {show.numbers
              .filter((number) => saved.some((review) => review.numberId === number.id))
              .map((number) => (
                <div key={number.id} className="flex flex-col gap-3">
                  <h3 className="px-1 text-base font-semibold text-muted-foreground">
                    {numberName(number)}
                  </h3>
                  {saved
                    .filter((review) => review.numberId === number.id)
                    .map((review) => (
                      <ReviewCard key={review.id} review={review} show={show} store={store} />
                    ))}
                </div>
              ))}
          </section>
        ))
      )}
    </div>
  )
}

/* ───────────── 내 정보 (계정) ───────────── */

function AccountScreen() {
  const user = useAuthUser()
  const [pending, setPending] = useState(false)
  return (
    <div className="flex flex-col gap-6 pt-4 pb-6 break-keep">
      <MobileScreenHeading>내 정보</MobileScreenHeading>
      {user === undefined ? (
        <Card aria-busy="true">
          <CardHeader>
            <CardTitle className="text-base font-semibold">로그인 상태를 확인하고 있어요</CardTitle>
          </CardHeader>
        </Card>
      ) : user ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{user.email}</CardTitle>
            <CardDescription>
              {user.created_at && `${new Date(user.created_at).toLocaleDateString("ko-KR")} 가입`}
              {user.email_confirmed_at ? " · 이메일 확인 완료" : " · 이메일 확인 전"}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              variant="tertiary"
              className="w-full"
              disabled={pending}
              onClick={async () => {
                setPending(true)
                await signOut()
                setPending(false)
              }}
            >
              <LogOut data-icon="inline-start" strokeWidth={2} aria-hidden />
              {pending ? "로그아웃 중…" : "로그아웃"}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">로그인하고 기록을 이어가세요</CardTitle>
            <CardDescription className="leading-relaxed">
              이메일로 가입하면 다른 기기에서도 같은 계정으로 로그인할 수 있어요.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/signup">회원가입</Link>
            </Button>
            <Button asChild variant="tertiary" className="w-full">
              <Link href="/login">로그인</Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
