import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useUiStore } from "../stores/useUiStore";
import { useProfileStore } from "../stores/useProfileStore";
import { useHistoryStore } from "../stores/useHistoryStore";
import { BlogCard } from "./blog-card";
import { HistoryPanel } from "../components/history-panel";
import { Card, CardContent } from "../components/ui/card";

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

export function BlogFeed() {
  const blogs = useProfileStore((state) => state.blogs);
  const result = useProfileStore((state) => state.result);
  const error = useProfileStore((state) => state.error);
  const isLoading = useProfileStore((state) => state.isLoading);
  const hasMore = useProfileStore((state) => state.hasMore);
  const onLoadMore = useProfileStore((state) => state.handleNextPage);

  const showReposted = useUiStore((state) => state.showReposted);
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

  const visibleBlogs = showReposted
    ? blogs
    : blogs.filter((blog) => {
        const authorId = blog.user?.idstr;
        return !authorId || authorId === activeUid;
      });

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
          <pre className="rounded-lg bg-destructive/10 p-3 text-sm whitespace-pre-wrap text-destructive">
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
          <div className="flex flex-col gap-3">
            {visibleBlogs.map((blog) => (
              <BlogCard key={blog.idstr} blog={blog} />
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
          <HistoryPanel />
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
