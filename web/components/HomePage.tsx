"use client";

import { useScrollProgress } from "@/hooks/useScrollProgress";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ShowcaseSection from "@/components/ShowcaseSection";
import StatsSection from "@/components/StatsSection";
import { useLiveStats, type LiveStats } from "@/lib/useLiveStats";

export default function HomePage({ initial }: { initial: LiveStats }) {
  const scrollProgress = useScrollProgress();
  const stats = useLiveStats(initial);

  return (
    <div className="min-h-[200vh]">
      <Navbar />
      <div className="relative" style={{ zIndex: 10 }}>
        <Hero
          scrollProgress={scrollProgress}
          volumeLabel={stats.volumeLabel}
          stockVolumeLabel={stats.stockVolumeLabel}
          dropCount={stats.dropCount}
          ready={stats.ready}
        />
        <ShowcaseSection scrollProgress={scrollProgress} />
      </div>
      <StatsSection initial={initial} />
      <footer className="relative z-30 px-6 pb-16 text-center">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-500">
          <a href="/gifts" className="hover:text-gray-900">Your gifts</a>
          <a href="/pool" className="hover:text-gray-900">Pool</a>
          <a href="/x" className="hover:text-gray-900">Send from X</a>
          <a href="/android" className="hover:text-gray-900">Android</a>
          <a href="/docs" className="hover:text-gray-900">How it works</a>
          <a href="/token" className="hover:text-gray-900">Token</a>
          <a href="/updates" className="hover:text-gray-900">Updates</a>
        </nav>
      </footer>
    </div>
  );
}
