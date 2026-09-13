"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a flash class for one tick after `value` changes, which is what
 * makes a 15-second refresh legible: only the cells that moved are marked, and
 * the direction of the change picks the colour.
 */
export function useFlashOnChange(value: number | null): string {
  const previousRef = useRef<number | null>(null);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = value;

    if (previous === null || value === null || previous === value) return;

    setFlashClass(value > previous ? "flash-gain" : "flash-loss");

    // Cleared so an identical next change re-triggers the animation.
    const timer = setTimeout(() => setFlashClass(""), 700);
    return () => clearTimeout(timer);
  }, [value]);

  return flashClass;
}
