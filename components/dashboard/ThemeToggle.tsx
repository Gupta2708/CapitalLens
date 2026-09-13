"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "capitallens-theme";

/**
 * The theme lives on `<html data-theme>`, written before hydration by the
 * inline script in layout.tsx. React is not its owner, so it is read with
 * useSyncExternalStore rather than synced into state -- one source of truth,
 * and no cascading render on mount.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/** The server has no DOM; dark is the documented default. */
function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isLight = theme === "light";

  const toggle = useCallback(() => {
    const next: Theme = isLight ? "dark" : "light";
    const root = document.documentElement;

    // Stamped on only for the length of the switch; permanently on every
    // element it would override the per-element transitions carrying transforms.
    root.setAttribute("data-theme-switching", "");
    root.setAttribute("data-theme", next);
    window.setTimeout(() => root.removeAttribute("data-theme-switching"), 260);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the theme still applies for this session.
    }
  }, [isLight]);

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isLight}
      aria-label="Light theme"
      title={`Switch to ${isLight ? "dark" : "light"} theme`}
      className="theme-switch"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-between px-[0.3125rem] text-text-muted"
      >
        <MoonIcon />
        <SunIcon />
      </span>

      <span
        className="theme-knob"
        aria-hidden="true"
        style={{ ["--knob-x" as string]: isLight ? "1.25rem" : "0rem" }}
      >
        <span className={`theme-icon ${isLight ? "theme-icon-hidden" : "theme-icon-shown"}`}>
          <MoonIcon />
        </span>
        <span className={`theme-icon ${isLight ? "theme-icon-shown" : "theme-icon-hidden"}`}>
          <SunIcon />
        </span>
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1.5v2M12 20.5v2M4 4l1.5 1.5M18.5 18.5L20 20M1.5 12h2M20.5 12h2M4 20l1.5-1.5M18.5 5.5L20 4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
