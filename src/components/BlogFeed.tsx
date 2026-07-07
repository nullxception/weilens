import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { WeiPost } from "../shared/WeiSchema";
import { BlogCard } from "./BlogCard";
import { HistoryPanel } from "./HistoryPanel";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

interface BlogFeedProps {
  blogs: WeiPost[];
  result: string;
  error: string;
  isLoading: boolean;
  onLoadMore: () => void;
  history: {
    uid: string;
    screenName: string;
    profileImageUrl: string;
    timestamp: number;
  }[];
  activeUid: string;
  activeDisplayName?: string;
  onHistoryClick: (uid: string) => void;
  onRemoveFromHistory: (uid: string) => void;
  onClearHistory: () => void;
}

export function BlogFeed({
  blogs,
  result,
  error,
  isLoading,
  onLoadMore,
  history,
  activeUid,
  activeDisplayName,
  onHistoryClick,
  onRemoveFromHistory,
  onClearHistory,
}: BlogFeedProps) {
  const [showReposted, setShowReposted] = useState(true);

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
        <pre className="whitespace-pre-wrap rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
                activeUid={activeUid}
                activeDisplayName={activeDisplayName}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={onLoadMore}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Loading..." : "Load More"}
              {!isLoading && <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </>
      ) : result ? (
        <pre className="min-h-64 whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
          {result}
        </pre>
      ) : history.length > 0 ? (
        <HistoryPanel
          history={history}
          activeUid={activeUid}
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
  );
}
