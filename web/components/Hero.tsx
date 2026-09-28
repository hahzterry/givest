"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import PopupCard from "@/components/PopupCard";

const TOKEN_CA = "0x0188da44dcc9b6c9d0d80de904c633c5ff227777";

function TokenCa() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(TOKEN_CA);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="mt-6 inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 px-4 py-2 font-mono text-[11px] text-gray-600 shadow-sm backdrop-blur-sm transition hover:border-gray-300 hover:text-gray-900 sm:text-xs"
      aria-label="Copy token contract address"
    >
      <span className="font-sans font-semibold tracking-wide text-gray-400">CA</span>
      <span className="hidden sm:inline">{TOKEN_CA}</span>
      <span className="sm:hidden">
        {TOKEN_CA.slice(0, 8)}…{TOKEN_CA.slice(-6)}
      </span>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-gray-400" />
      )}
    </button>
  );
}

function LiveNumbers({
  volumeLabel,
  stockVolumeLabel,
  dropCount,
  ready,
}: {
  volumeLabel: string;
  stockVolumeLabel: string;
  dropCount: number;
  ready: boolean;
}) {
  const show = (value: string | number) => (ready ? value : "…");
  return (
    <div className="mt-10 w-full max-w-xl">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <a href="/volume" className="rounded-2xl border border-gray-200/80 bg-white/80 px-3 py-4 text-left shadow-sm backdrop-blur-sm transition hover:border-gray-300 sm:px-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-gray-400 uppercase">Volume</p>
          <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 sm:text-3xl">{show(volumeLabel)}</p>
        </a>
        <a href="/volume" className="rounded-2xl border border-gray-200/80 bg-white/80 px-3 py-4 text-left shadow-sm backdrop-blur-sm transition hover:border-gray-300 sm:px-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-gray-400 uppercase">Drops</p>
          <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 sm:text-3xl">{show(dropCount)}</p>
        </a>
        <a href="/volume" className="rounded-2xl border border-gray-200/80 bg-white/80 px-3 py-4 text-left shadow-sm backdrop-blur-sm transition hover:border-gray-300 sm:px-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-gray-400 uppercase">Stock</p>
          <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 sm:text-3xl">{show(stockVolumeLabel)}</p>
        </a>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        {ready ? "Live from Robinhood Chain." : "Reading the chain…"}{" "}
        <a href="/volume" className="underline-offset-2 hover:text-gray-700 hover:underline">
          Verify
        </a>
      </p>
    </div>
  );
}

export default function Hero({
  scrollProgress,
  volumeLabel,
  stockVolumeLabel,
  dropCount,
  ready,
}: {
  scrollProgress: number;
  volumeLabel: string;
  stockVolumeLabel: string;
  dropCount: number;
  ready: boolean;
}) {
  const opacity = Math.max(1 - scrollProgress * 2.5, 0);
  const translateY = scrollProgress * -60;

  return (
    <section
      className="relative flex min-h-screen flex-col items-center justify-start px-4 pt-32 text-center will-change-transform sm:px-6 sm:pt-36 md:pt-40"
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 10,
        pointerEvents: opacity < 0.1 ? "none" : "auto",
      }}
    >
      <h1 className="max-w-2xl text-[2.25rem] leading-none font-medium tracking-tighter text-gray-900 sm:text-[3rem] md:text-[3.75rem]">
        <span className="text-zinc-400">A New Way</span>
        <br />
        to Send Your
        <br />
        Stock Tokens
      </h1>

      <p className="mt-8 max-w-sm text-base leading-relaxed text-gray-500">
        A stock, a dollar amount, a link. They claim it. You paid the gas.
      </p>

      <div className="mt-8 grid w-full max-w-xl grid-cols-2 gap-3 text-left">
        <a href="/send" className="rounded-[24px] bg-gray-900 px-5 py-5 text-white shadow-lg transition hover:bg-gray-800">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-white/50 uppercase">Send</p>
          <p className="mt-3 text-xl font-medium tracking-tight">Pick a stock.</p>
          <p className="mt-1 text-sm leading-snug text-white/70">$10, or any amount. You get a private link.</p>
        </a>
        <a href="/claim" className="rounded-[24px] border border-gray-200/80 bg-white/85 px-5 py-5 text-gray-900 shadow-sm backdrop-blur-sm transition hover:border-gray-300">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-gray-400 uppercase">Claim</p>
          <p className="mt-3 text-xl font-medium tracking-tight">Open the link.</p>
          <p className="mt-1 text-sm leading-snug text-gray-500">One tap. No gas. No wallet setup first.</p>
        </a>
      </div>

      <LiveNumbers
        volumeLabel={volumeLabel}
        stockVolumeLabel={stockVolumeLabel}
        dropCount={dropCount}
        ready={ready}
      />

      <p className="mt-4 max-w-sm text-sm text-gray-500">
        iPhone is not out yet.{" "}
        <a href="/android" className="font-medium text-gray-800 underline-offset-2 hover:underline">
          Android is live
        </a>
        {" · "}
        <a href="/updates" className="text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline">
          updates
        </a>
      </p>

      <TokenCa />

      <PopupCard />
    </section>
  );
}
