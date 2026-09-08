"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import StockLogo from "@/components/StockLogo";
import { stockBySymbol } from "@/lib/config";
import { readUsdPrice } from "@/lib/prices";
import type { XCommand } from "@/lib/xCommand";

const EXAMPLE = "@usegivest send this person $10 of NVDA";

type ParseResponse = {
  command: XCommand;
  sendHref: string;
  text: string;
  author: string | null;
  replyingTo: string | null;
  source: "post" | "text";
};

export default function SendFromXPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setInput(q);
      void read(q);
    }
    // First paint only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function read(raw: string) {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/x/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: raw }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not read that.");
      }
      setResult(body as ParseResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that.");
    } finally {
      setLoading(false);
    }
  }

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(EXAMPLE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard blocked. The text is visible anyway.
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-[1] bg-white/55 backdrop-blur-[3px]" />
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-6 pt-28 pb-20">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-400 uppercase">
            Send from X
          </p>
          <h1 className="mt-4 text-[2.35rem] leading-none font-medium tracking-tighter text-gray-900 sm:text-[3rem]">
            Tag a handle.{" "}
            <span className="text-zinc-400">Send them stock.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-gray-500 sm:text-base">
            Write a post like the one below, or reply to someone with it. Paste
            the link here. We read who, how much, and which stock, and open a
            gift locked to that account. You confirm and send.
          </p>
        </header>

        <div className="mt-8 rounded-2xl border border-gray-200/60 bg-white/80 p-4 backdrop-blur-md sm:p-5">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-gray-400 uppercase">
            The command
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <code className="text-sm text-gray-900 sm:text-base">{EXAMPLE}</code>
            <button
              type="button"
              onClick={copyExample}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Handle, dollars, ticker. Say <span className="font-medium text-gray-700">this person</span> in a
            reply, or name a handle like <span className="font-medium text-gray-700">@alice</span>.
          </p>
        </div>

        <form
          className="popup-card-animate mt-6 rounded-2xl border border-gray-200/60 bg-white/95 p-5 shadow-lg backdrop-blur-md sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void read(input);
          }}
        >
          <label htmlFor="x-input" className="sr-only">
            Post link or command text
          </label>
          <textarea
            id="x-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="https://x.com/you/status/… or paste the command text"
            className="input w-full resize-none px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm"
          >
            <Search className="h-4 w-4" />
            {loading ? "Reading the post…" : "Read it"}
          </button>
          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>

        {result && <ResultCard result={result} />}

        <section className="mt-10 rounded-2xl border border-gray-200/60 bg-white/70 p-5 sm:p-6">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-gray-400 uppercase">
            Where this is
          </p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <Step n="01" title="Live today" body="Paste the post. We read it and prefill a gift locked to that handle. You confirm in your wallet." />
            <Step n="02" title="Next" body="Tag @usegivest in the reply and we pick it up ourselves. No paste. You approve once, we send." />
            <Step n="03" title="Always" body="The recipient claims on usegivest.app. Relayer pays gas. If they never claim, you refund." />
          </dl>
        </section>
      </main>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <dt className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold tracking-[0.16em] text-gray-400">{n}</span>
        <span className="font-semibold text-gray-900">{title}</span>
      </dt>
      <dd className="mt-1.5 leading-relaxed text-gray-500">{body}</dd>
    </div>
  );
}

function ResultCard({ result }: { result: ParseResponse }) {
  const { command } = result;
  const stock = stockBySymbol(command.symbol);
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    setPrice(null);
    if (stock?.feed) readUsdPrice(stock.feed).then(setPrice);
  }, [stock]);

  const shares = price ? command.usd / price : null;
  const recipient = command.handle;

  return (
    <section className="popup-card-animate mt-6 rounded-2xl border border-gray-200/60 bg-white/95 p-6 shadow-lg sm:p-7">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-gray-400 uppercase">
        We read this
      </p>

      <div className="mt-4 flex items-center gap-4">
        <StockLogo symbol={command.symbol} size={48} />
        <div>
          <p className="text-2xl font-semibold tracking-tight text-gray-900">
            ${command.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })} of {command.symbol}
          </p>
          <p className="text-sm text-gray-500">
            {shares
              ? `About ${shares.toLocaleString("en-US", { maximumFractionDigits: 4 })} shares at $${price?.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
              : stock?.name ?? command.symbol}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <Row
          label="Locked to"
          value={
            recipient ? (
              <span className="inline-flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://unavatar.io/x/${recipient}`}
                  alt=""
                  className="h-5 w-5 rounded-full bg-gray-100"
                />
                @{recipient}
              </span>
            ) : (
              <span className="text-amber-700">Unknown. Reply to them, or name a handle.</span>
            )
          }
        />
        <Row
          label="Read from"
          value={
            result.source === "post" && result.author
              ? `A post by @${result.author}`
              : "The text you pasted"
          }
        />
      </dl>

      <p className="mt-5 rounded-xl border border-gray-100 bg-gray-50/80 px-3.5 py-2.5 text-xs leading-relaxed text-gray-500">
        &ldquo;{result.text}&rdquo;
      </p>

      {recipient ? (
        <Link
          href={result.sendHref}
          className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm"
        >
          Continue to send
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      ) : (
        <p className="mt-6 text-sm text-gray-500">
          We could not tell who gets it. If you replied to them, X did not
          give us the reply target. Add their handle to the post and try again.
        </p>
      )}
      <p className="mt-3 text-center text-xs text-gray-400">
        Nothing is sent from this page. You confirm on the next screen.
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-3">
      <dt className="text-[11px] font-semibold tracking-[0.14em] text-gray-400 uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-gray-900">{value}</dd>
    </div>
  );
}
