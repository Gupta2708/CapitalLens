"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a flash class for one tick after `value` changes.
 *
 * This is what makes a 15-second refresh legible. Without it the reader either
 * misses the update entirely or has to diff the table by eye; with a spinner or
 * a re-mount they lose their place. A brief tint on exactly the cells that
 * moved shows what changed while nothing shifts position.
 *
 * The direction of the change picks the colour, so a rising price flashes green
 * and a falling one red.
 */
export function useFlashOnChange(value: number | null): string {
  const previousRef = useRef<number | null>(null);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = value;

    // Nothing to compare on first render, and no flash when the value holds.
    if (previous === null || value === null || previous === value) return;

    setFlashClass(value > previous ? "flash-gain" : "flash-loss");

    // Clear the class so an identical next change re-triggers the animation.
    const timer = setTimeout(() => setFlashClass(""), 700);
    return () => clearTimeout(timer);
  }, [value]);

  return flashClass;
}
