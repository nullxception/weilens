import React from "react";
import { motion } from "motion/react";

const SettingsPanel = React.lazy(() =>
  import("@/settings/settings-panel").then((m) => ({
    default: m.SettingsPanel,
  })),
);

export function SettingsPage() {
  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="px-4 pb-4"
    >
      <SettingsPanel />
    </motion.div>
  );
}
