import { motion } from "motion/react";

import { LogsView } from "@/components/logs-view";

export function LogsPage() {
  return (
    <motion.div
      key="logs"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="px-4 pb-4"
    >
      <LogsView />
    </motion.div>
  );
}
