import type { ReactNode } from "react";

type Tone = "neutral" | "gain" | "loss" | "warn" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-overlay text-text-secondary border-border-subtle",
  gain: "bg-gain-soft text-gain border-transparent",
  loss: "bg-loss-soft text-loss border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
};

/** Small status pill. Used for freshness, exchange tags and provider state. */
export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
