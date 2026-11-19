import { shows, type AudienceReview, type Show } from "@/lib/show-data"

/*
 * 관극 성향: 후기 글에 어떤 종류의 관찰이 많은지를 키워드로 센 값이다.
 * 사람이 직접 고른 태그나 모델 분석이 아니라, 화면에서 바로 계산하는 단순한 규칙이다.
 */
export const DIMENSIONS = [
  { key: "stage", label: "연출·디테일", words: ["조명", "무대", "세트", "동선", "소품", "의상", "연출", "대형", "시선", "동작", "구도", "전환", "바닥", "그림자"] },
  { key: "acting", label: "배우·연기", words: ["연기", "표정", "배우", "목소리", "눈빛", "엘리자벳은", "죽음은", "루케니는", "라이토", "손짓", "웃"] },
  { key: "music", label: "음악·넘버", words: ["노래", "합창", "화음", "음악", "고음", "템포", "박자", "소절", "듀엣", "리듬", "박수"] },
  { key: "foreshadow", label: "복선·반복", words: ["다시", "마지막", "복선", "반복", "비교", "리프라이즈", "돌아온다", "1막", "2막", "나중", "같은", "처음"] },
  { key: "emotion", label: "감정·여운", words: ["마음", "슬프", "눈물", "섬뜩", "짠하", "아름다", "감동", "무섭", "씁쓸", "숨", "울"] },
  { key: "tip", label: "관람 팁", words: ["좌석", "3층", "1층", "2층", "앞쪽", "객석", "보이", "뒤쪽", "시야", "잘림", "추천"] },
] as const

export type Vec = number[]

export function vectorOf(texts: string[]): Vec {
  const v = DIMENSIONS.map(() => 0)
  for (const text of texts)
    DIMENSIONS.forEach((d, i) => {
      for (const w of d.words) if (text.includes(w)) v[i] += 1
    })
  return v
}

const total = (v: Vec) => v.reduce((a, b) => a + b, 0)

/** 0~100. 비교할 글이 없으면 null */
export function matchPct(a: Vec, b: Vec): number | null {
  if (total(a) === 0 || total(b) === 0) return null
  const dot = a.reduce((s, x, i) => s + x * b[i], 0)
  const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0))
  const nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0))
  // 코사인 유사도는 비슷한 값끼리 몰리므로 제곱해서 차이를 벌린다.
  const cos = dot / (na * nb)
  return Math.round(cos * cos * 100)
}

/** 비중이 큰 성향 순서 */
export function topDimensions(v: Vec, count = 2) {
  const sum = total(v)
  if (sum === 0) return []
  return DIMENSIONS.map((d, i) => ({ ...d, share: v[i] / sum }))
    .sort((a, b) => b.share - a.share)
    .slice(0, count)
}

export type Reviewer = { author: string; vec: Vec; reviewCount: number; showIds: string[] }

let reviewers: Reviewer[] | null = null

export function allReviewers(): Reviewer[] {
  if (reviewers) return reviewers
  const map = new Map<string, { texts: string[]; showIds: Set<string> }>()
  for (const show of shows)
    for (const r of show.reviews) {
      const e = map.get(r.author) ?? { texts: [], showIds: new Set<string>() }
      e.texts.push(r.body)
      e.showIds.add(show.id)
      map.set(r.author, e)
    }
  reviewers = [...map.entries()].map(([author, e]) => ({
    author,
    vec: vectorOf(e.texts),
    reviewCount: e.texts.length,
    showIds: [...e.showIds],
  }))
  return reviewers
}

export function reviewerOf(author: string) {
  return allReviewers().find((r) => r.author === author)
}

/** 내 성향: 북마크한 후기와 내가 쓴 기록(가중치 2배)에서 센다. */
export function myVector(bookmarkedBodies: string[], writtenTexts: string[]): Vec {
  return vectorOf([...bookmarkedBodies, ...writtenTexts, ...writtenTexts])
}

export function showVector(show: Show): Vec {
  return vectorOf(show.reviews.map((r) => r.body))
}

export function recommendReviewers(my: Vec, opts: { showId?: string; limit?: number } = {}) {
  return allReviewers()
    .filter((r) => !opts.showId || r.showIds.includes(opts.showId))
    .map((r) => ({ reviewer: r, pct: matchPct(my, r.vec) }))
    .filter((x): x is { reviewer: Reviewer; pct: number } => x.pct != null)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, opts.limit ?? 4)
}

/* ───────────── 다시 쓰기: 내 글과 맞닿은 앞뒤 맥락 후기 ───────────── */

function grams(text: string) {
  const s = text.replace(/[^\p{Script=Hangul}\p{L}\p{N}]/gu, "")
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}

export type ContextHit = { review: AudienceReview; relation: "before" | "same" | "after" }

/**
 * 내가 쓴 글의 단어와 겹치는 정도로, 같은 넘버와 앞뒤 넘버의 다른 관객 후기를 고른다.
 * 이미 북마크한 후기는 단서로 보고 있으니 뺀다.
 */
export function contextReviews(show: Show, numberId: string, myText: string, exclude: string[], limit = 2): ContextHit[] {
  const mine = grams(myText)
  if (mine.size === 0) return []
  const idx = show.numbers.findIndex((n) => n.id === numberId)
  if (idx < 0) return []
  const near: Record<string, ContextHit["relation"]> = {}
  show.numbers.forEach((n, i) => {
    if (i === idx) near[n.id] = "same"
    else if (i === idx - 1) near[n.id] = "before"
    else if (i === idx + 1) near[n.id] = "after"
  })
  return show.reviews
    .filter((r) => near[r.numberId] && !exclude.includes(r.id))
    .map((review) => {
      const g = grams(review.body)
      let overlap = 0
      g.forEach((x) => mine.has(x) && overlap++)
      return { review, relation: near[review.numberId], score: overlap + Math.log1p(review.bookmarks) * 0.1 }
    })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ review, relation }) => ({ review, relation }))
}
