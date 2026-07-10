import { useEffect, useRef, useState } from "react"
import type { WeiPost } from "../shared/WeiSchema"
import { useAppStore, type AppState } from "../stores/appStore"
import { BlogCard } from "./BlogCard"
import { HistoryPanel } from "./HistoryPanel"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"

interface BlogFeedProps {
  blogs: WeiPost[]
  result: string
  error: string
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
  activeDisplayName?: string
}

export function BlogFeed({
  blogs,
  result,
  error,
  isLoading,
  hasMore,
  onLoadMore,
  activeDisplayName,
}: BlogFeedProps) {
  const [showReposted, setShowReposted] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isLoadingRef = useRef(isLoading)
  isLoadingRef.current = isLoading

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingRef.current) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])
  const activeUid = useAppStore((state: AppState) => state.activeUid)
  const history = useAppStore((state: AppState) => state.history)
  const onHistoryClick = useAppStore(
    (state: AppState) => state.openHistoryProfile
  )
  const onRemoveFromHistory = useAppStore(
    (state: AppState) => state.removeFromHistory
  )
  const onClearHistory = useAppStore((state: AppState) => state.clearHistory)

  const visibleBlogs = showReposted
    ? blogs
    : blogs.filter((blog) => {
        const authorId = blog.user?.idstr
        return !authorId || authorId === activeUid
      })

  const repostCount = blogs.filter((blog) => {
    const authorId = blog.user?.idstr
    return Boolean(authorId && authorId !== activeUid)
  }).length

  return (
    <>
      {error ? (
        <pre className="rounded-lg bg-destructive/10 px-4 py-3 text-sm whitespace-pre-wrap text-destructive">
          {error}
        </pre>
      ) : isLoading && blogs.length === 0 ? (
        <Card>
          <CardContent
            className="flex min-h-64 flex-col items-center justify-center gap-3"
            role="status"
            aria-live="polite"
          >
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm font-semibold text-foreground">
              Loading blog posts…
            </p>
            <p className="text-xs text-muted-foreground">
              Fetching the latest results.
            </p>
          </CardContent>
        </Card>
      ) : blogs.length > 0 ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {visibleBlogs.length} of {blogs.length} posts shown
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReposted((prev) => !prev)}
              disabled={repostCount === 0}
            >
              {showReposted ? "Hide reposts" : "Show reposts"}
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {visibleBlogs.map((blog) => (
              <BlogCard
                key={blog.idstr}
                blog={blog}
                activeDisplayName={activeDisplayName}
              />
            ))}
          </div>
          <div
            ref={sentinelRef}
            className="mt-3 flex items-center justify-center py-4"
          >
            {isLoading && (
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
            )}
          </div>
        </>
      ) : result ? (
        <pre className="min-h-64 rounded-lg bg-muted px-4 py-3 text-sm whitespace-pre-wrap text-foreground">
          {result}
        </pre>
      ) : history.length > 0 ? (
        <HistoryPanel
          history={history}
          onProfileClick={onHistoryClick}
          onRemove={onRemoveFromHistory}
          onClear={onClearHistory}
        />
      ) : (
        <Card>
          <CardContent className="px-3 py-4 text-center">
            <p className="text-sm font-semibold text-foreground">
              Paste a UID to start checking
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your recently viewed profiles will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
