import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BlogResponseSchema, type BlogPost } from "../types/remote";
import { useAuthStore } from "../stores/useAuthStore";
import { useHistoryStore } from "../stores/useHistoryStore";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

async function fetchProfile(
  uidToCheck: string,
  targetPage: number,
  cookie: string,
  sinceId?: string,
) {
  const targetUid = uidToCheck.trim();
  if (!targetUid) {
    throw new Error("UID is required.");
  }

  const referer = `https://weibo.com/u/${targetUid}`;
  const headers = {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "client-version": "3.0.0",
    pragma: "no-cache",
    priority: "u=1, i",
    referer,
    "sec-ch-ua":
      '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "server-version": "v2026.06.30.1",
    "user-agent": navigator.userAgent,
    "x-requested-with": "XMLHttpRequest",
    cookie: cookie,
  };

  const params = new URLSearchParams({
    uid: targetUid,
    page: String(targetPage),
    feature: "0",
  });

  if (sinceId) {
    params.set("since_id", sinceId);
  }

  const response = await tauriFetch(
    `https://weibo.com/ajax/statuses/mymblog?${params.toString()}`,
    {
      method: "GET",
      headers,
    },
  );

  const body = await response.text();
  const parsedJson = JSON.parse(body);
  const validationResult = BlogResponseSchema.safeParse(parsedJson);

  if (!validationResult.success) {
    console.error("Zod validation error:", validationResult.error);
    throw new Error(
      `Fetch succeeded, but validation failed:\n${validationResult.error.message}`,
    );
  }

  return {
    fetchedBlogs: validationResult.data.data.list,
    sinceId: validationResult.data.data.since_id,
    status: response.status,
    statusText: response.statusText,
  };
}

export function useProfileLookup() {
  const [uid, setUid] = useState("");
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [activeDisplayName, setActiveDisplayName] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [sinceId, setSinceId] = useState<string>();

  const queryClient = useQueryClient();
  const cookie = useAuthStore((state) => state.cookie);
  const parsedCookie = useAuthStore((state) => state.parsedCookie);
  const addToHistory = useHistoryStore((state) => state.addToHistory);

  async function checkUid(uidToCheck: string, targetPage = 1) {
    const targetUid = uidToCheck.trim();
    if (!targetUid) return;

    setIsLoading(true);
    setError("");
    setResult("");
    const requestSinceId = targetPage === 1 ? undefined : sinceId;

    if (targetPage === 1) {
      setBlogs([]);
      setSinceId(undefined);
    }
    setPage(targetPage);

    try {
      const queryResult = await queryClient.fetchQuery({
        queryKey: ["weisearch", targetUid, targetPage, requestSinceId, cookie],
        queryFn: () =>
          fetchProfile(targetUid, targetPage, parsedCookie, requestSinceId),
        staleTime: 5 * 60_000,
        retry: 0,
      });

      const {
        fetchedBlogs,
        sinceId: nextSinceId,
        status,
        statusText,
      } = queryResult;

      if (targetPage === 1) {
        setBlogs(fetchedBlogs);
      } else {
        setBlogs((prev) => [...prev, ...fetchedBlogs]);
      }

      setSinceId(nextSinceId);

      setResult(
        `status: ${status} ${statusText}\n\nSuccessfully parsed ${fetchedBlogs.length} Wei status posts.`,
      );

      const firstBlog = fetchedBlogs[0];
      const screenName = firstBlog?.user?.screen_name || `UID: ${targetUid}`;
      const profileImageUrl = firstBlog?.user?.profile_image_url || "";

      setActiveDisplayName(screenName);
      addToHistory(targetUid, screenName, profileImageUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error while fetching via RPC.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleNextPage() {
    checkUid(uid, page + 1);
  }

  const hasMore = sinceId !== undefined && sinceId !== "";

  return {
    uid,
    setUid,
    blogs,
    activeDisplayName,
    result,
    error,
    isLoading,
    hasMore,
    checkUid,
    handleNextPage,
  };
}
