import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Eye,
  EyeOff,
  ClipboardPaste,
  ArrowRight,
  ChevronRight,
  Cookie,
  ExternalLink,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { useAuthStore } from "../stores/useAuthStore";
import { markOnboardingComplete } from "./onboarding-state";

/* ── Animation variants ─────────────────────────────────────── */

const pageVariants = {
  enter: { opacity: 0, x: 60 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

const pageTransition = {
  type: "spring" as const,
  stiffness: 200,
  damping: 25,
  mass: 1.2,
};

const stagger = {
  animate: { transition: { staggerChildren: 0.2 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

/* ── Welcome step ───────────────────────────────────────────── */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      key="welcome"
      variants={pageVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={pageTransition}
      className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 text-center"
    >
      <motion.div variants={stagger} initial="initial" animate="animate">
        {/* Logo */}
        <motion.div
          variants={fadeUp}
          className="mx-auto mb-6 size-20 overflow-hidden rounded-2xl shadow-lg"
        >
          <img
            src="/logo.jpg"
            alt="WeiLens logo"
            className="size-full object-cover"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={fadeUp}
          className="text-3xl font-bold tracking-tight"
        >
          Welcome to{" "}
          <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            WeiLens
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground"
        >
          Browse and download posts, photos, and videos from Sina Weibo — all
          from your desktop.
        </motion.p>

        {/* Feature pills */}
        <motion.div
          variants={fadeUp}
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          {[
            "Photo download",
            "Video download",
            "Watermark removal",
            "EXIF data",
          ].map((feat) => (
            <span
              key={feat}
              className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
            >
              {feat}
            </span>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Button onClick={onNext} size="lg" className="gap-2 px-6">
          Get Started
          <ArrowRight className="size-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

/* ── Cookie step ────────────────────────────────────────────── */

function CookieStep({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const cookie = useAuthStore((s) => s.cookie);
  const setCookie = useAuthStore((s) => s.setCookie);
  const saveCookie = useAuthStore((s) => s.saveCookie);
  const [localCookie, setLocalCookie] = useState(cookie);
  const [blurred, setBlurred] = useState(true);
  const [pasted, setPasted] = useState(false);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLocalCookie(text);
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch {
      // clipboard access denied or unavailable
    }
  }, []);

  const handleSave = useCallback(() => {
    setCookie(localCookie);
    saveCookie();
    onComplete();
  }, [localCookie, setCookie, saveCookie, onComplete]);

  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  return (
    <motion.div
      key="cookie"
      variants={pageVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={pageTransition}
      className="mx-auto flex w-full max-w-lg flex-col gap-6"
    >
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="flex flex-col items-center gap-4 text-center"
      >
        <motion.div
          variants={fadeUp}
          className="flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/50 p-3"
        >
          <Cookie className="size-7 text-muted-foreground" strokeWidth={1.5} />
        </motion.div>

        <motion.div variants={fadeUp}>
          <h2 className="text-xl font-bold tracking-tight">Connect to Weibo</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Paste your Sina Weibo cookie so WeiLens can load posts and media.
          </p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <Label htmlFor="onboard-cookie" className="text-xs font-medium">
            Cookie
          </Label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePaste}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Paste from clipboard"
            >
              {pasted ? (
                <span className="text-green-500 text-xs font-bold">✓</span>
              ) : (
                <ClipboardPaste className="size-3.5" />
              )}
              <span>{pasted ? "Pasted" : "Paste"}</span>
            </button>
            <button
              type="button"
              onClick={() => setBlurred((b) => !b)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={blurred ? "Show cookie" : "Hide cookie"}
            >
              {blurred ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
              <span>{blurred ? "Show" : "Hide"}</span>
            </button>
          </div>
        </div>

        <div className={blurred ? "rounded-md border border-input overflow-hidden" : ""}>
          <Textarea
            id="onboard-cookie"
            rows={5}
            value={localCookie}
            onChange={(e) => setLocalCookie(e.target.value)}
            placeholder="Paste your full cookie string here"
            className={
              blurred
                ? "resize-none text-sm blur-sm transition-[filter] select-none border-none bg-input/20"
                : "resize-none text-sm blur-none transition-[filter]"
            }
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: Use the{" "}
          <a
            href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Get cookies.txt locally
            <ExternalLink className="size-3" />
          </a>{" "}
          extension to export your cookie.
        </p>

        <Button
          onClick={handleSave}
          disabled={!localCookie.trim()}
          className="mt-1 gap-2"
        >
          Save & Continue
          <ChevronRight className="size-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-muted-foreground"
        >
          Skip for now — I'll set it up later
        </Button>
      </motion.div>
    </motion.div>
  );
}

/* ── Main onboarding ────────────────────────────────────────── */

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<"welcome" | "cookie">("welcome");

  const handleComplete = useCallback(() => {
    markOnboardingComplete();
    onComplete();
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      {/* Subtle background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.97_0_0/0.8),oklch(1_0_0)_70%)] dark:bg-[radial-gradient(ellipse_at_center,oklch(0.2_0_0/0.6),oklch(0.145_0_0)_70%)]" />

      <div className="relative flex w-full items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {step === "welcome" ? (
            <WelcomeStep key="welcome" onNext={() => setStep("cookie")} />
          ) : (
            <CookieStep
              key="cookie"
              onComplete={handleComplete}
              onSkip={handleComplete}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
