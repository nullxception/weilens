import { useEffect } from "react";
import { motion } from "motion/react";
import { useUiStore } from "@/stores/useUiStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { BlogFeed } from "@/feed/blog-feed";

export function IndexPage() {
  const pendingLookupUid = useUiStore((state) => state.pendingLookupUid);
  const setPendingLookupUid = useUiStore((state) => state.setPendingLookupUid);
  const setActiveUid = useUiStore((state) => state.setActiveUid);

  const checkUid = useProfileStore((state) => state.checkUid);
  const setUid = useProfileStore((state) => state.setUid);

  useEffect(() => {
    if (!pendingLookupUid) return;
    setUid(pendingLookupUid);
    setActiveUid(pendingLookupUid);
    checkUid(pendingLookupUid);
    setPendingLookupUid(null);
  }, [
    pendingLookupUid,
    setActiveUid,
    setPendingLookupUid,
    setUid,
    checkUid,
  ]);

  return (
    <motion.div
      key="search"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <BlogFeed />
    </motion.div>
  );
}
