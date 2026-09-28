"use client";

import { useEffect, useState } from "react";

export type LiveStats = {
  volumeLabel: string;
  stockVolumeLabel: string;
  dropCount: number;
  /** False until a real chain read has landed. Never render $0 for that. */
  ready: boolean;
};

/** Hydrates with SSR values, then polls /api/stats so numbers stay live. */
export function useLiveStats(initial: LiveStats, intervalMs = 15_000): LiveStats {
  const [stats, setStats] = useState<LiveStats>(initial);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let ready = initial.ready;

    async function load() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (res.ok) {
          const d = await res.json();
          if (!stopped && d?.volumeLabel && typeof d.dropCount === "number") {
            ready = true;
            setStats({
              volumeLabel: d.volumeLabel,
              stockVolumeLabel: d.stockVolumeLabel ?? "$0",
              dropCount: d.dropCount,
              ready: true,
            });
          }
        }
      } catch {
        // keep the last good read
      }
      if (!stopped) {
        timer = window.setTimeout(load, ready ? intervalMs : 4_000);
      }
    }

    timer = window.setTimeout(load, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [initial.ready, intervalMs]);

  return stats;
}
