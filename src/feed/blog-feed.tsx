import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { BlogPost } from "../types/remote";
import { useUiStore } from "../stores/useUiStore";
import { useHistoryStore } from "../stores/useHistoryStore";
import { BlogCard } from "./blog-card";
import { HistoryPanel } from "../components/history-panel";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

interface BlogFeedProps {
  blogs: BlogPost[];
  result: string;
  error: string;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  activeDisplayName?: string;
}

const stateVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stateTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

export function BlogFeed({
  blogs,
  result,
  error,
  isLoading,
  hasMore,
  onLoadMore,
  activeDisplayName,
}: BlogFeedProps) {
  const [showReposted, setShowReposted] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingRef.current) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);
  const activeUid = useUiStore((state) => state.activeUid);
  const history = useHistoryStore((state) => state.history);
  const onHistoryClick = useUiStore((state) => state.openHistoryProfile);
  const onRemoveFromHistory = useHistoryStore(
    (state) => state.removeFromHistory,
  );
  const onClearHistory = useHistoryStore((state) => state.clearHistory);

  const visibleBlogs = showReposted
    ? blogs
    : blogs.filter((blog) => {
        const authorId = blog.user?.idstr;
        return !authorId || authorId === activeUid;
      });

  const repostCount = blogs.filter((blog) => {
    const authorId = blog.user?.idstr;
    return Boolean(authorId && authorId !== activeUid);
  }).length;

  return (
    <>
      {error ? (
        <motion.div
          key="error"
          variants={stateVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={stateTransition}
        >
          <pre className="rounded-lg bg-destructive/10 px-4 py-3 text-sm whitespace-pre-wrap text-destructive">
            {error}
          </pre>
        </motion.div>
      ) : isLoading && blogs.length === 0 ? (
        <motion.div
          key="loading"
          variants={stateVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={stateTransition}
        >
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
        </motion.div>
      ) : blogs.length > 0 ? (
        <motion.div
          key="blogs"
          variants={stateVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={stateTransition}
        >
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
        </motion.div>
      ) : result ? (
        <motion.div
          key="result"
          variants={stateVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={stateTransition}
        >
          <pre className="min-h-64 rounded-lg bg-muted px-4 py-3 text-sm whitespace-pre-wrap text-foreground">
            {result}
          </pre>
        </motion.div>
      ) : history.length > 0 ? (
        <motion.div
          key="history"
          variants={stateVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={stateTransition}
        >
          <HistoryPanel
            history={history}
            onProfileClick={onHistoryClick}
            onRemove={onRemoveFromHistory}
            onClear={onClearHistory}
          />
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          variants={stateVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={stateTransition}
        >
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
        </motion.div>
      )}

      {blogs.length > 0 && (
        <div
          ref={sentinelRef}
          className="mt-3 flex items-center justify-center py-4"
        >
          {isLoading && (
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
          )}
        </div>
      )}
    </>
  );
}
