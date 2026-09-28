"use client";

import Navbar from "@/components/Navbar";
import ShowcaseSection from "@/components/ShowcaseSection";
import StatsSection from "@/components/StatsSection";
import { useLiveStats, type LiveStats } from "@/lib/useLiveStats";

export default function HomePage({ initial }: { initial: LiveStats }) {
  const stats = useLiveStats(initial);

  return (
    <div>
      <Navbar />
      <div className="relative z-10 pt-24">
        <StatsSection initial={stats} />
        <ShowcaseSection scrollProgress={1} />
      </div>
    </div>
  );
}
