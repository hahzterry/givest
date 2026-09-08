import { STOCKS } from "./config";

/**
 * Parses a Givest send command written as a post on X.
 *
 *   @usegivest send this person $10 of NVDA
 *   @usegivest send @alice $25 of TSLA
 *   @usegivest send 10 dollars of AAPL to @bob
 *   @usegivest send @bob $50 $MSFT
 *
 * We read three things: who (a handle, or the account being replied to),
 * how much in dollars, and which stock. Everything else is ignored.
 */

export const BOT_HANDLE = "usegivest";

export type XCommand = {
  /** X handle without the @. Null when the post says "this person" and we do not know the reply target. */
  handle: string | null;
  /** True when the command points at the reply target instead of naming a handle. */
  pointsAtReplyTarget: boolean;
  usd: number;
  symbol: string;
};

export type XCommandResult =
  | { ok: true; command: XCommand }
  | { ok: false; error: string };

const SELF_WORDS = /\b(this person|this account|them|him|her|you)\b/i;
const HANDLE_RE = /@([A-Za-z0-9_]{1,15})\b/g;
const USD_BEFORE = /\$\s?(\d+(?:[.,]\d+)?)(?!\w)/;
const USD_AFTER = /(\d+(?:[.,]\d+)?)\s?(?:\$|usd|dollars?|bucks)\b/i;

function toNumber(raw: string): number {
  return Number(raw.replace(",", "."));
}

export function cleanCommandText(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseXCommand(
  raw: string,
  replyingTo?: string | null,
): XCommandResult {
  const text = cleanCommandText(raw);
  if (!text) return { ok: false, error: "Nothing to read." };

  if (!/\bsend\b/i.test(text) && !/\bgive\b/i.test(text) && !/\bgift\b/i.test(text)) {
    return { ok: false, error: "The post needs the word send. Example: send this person $10 of NVDA" };
  }

  const handles: string[] = [];
  for (const m of text.matchAll(HANDLE_RE)) {
    if (m[1].toLowerCase() !== BOT_HANDLE) handles.push(m[1]);
  }

  const pointsAtReplyTarget = SELF_WORDS.test(text) && handles.length === 0;
  let handle: string | null = null;
  if (handles.length > 0) {
    handle = handles[0];
  } else if (replyingTo && replyingTo.toLowerCase() !== BOT_HANDLE) {
    handle = replyingTo;
  }

  const usdMatch = text.match(USD_BEFORE) ?? text.match(USD_AFTER);
  if (!usdMatch) {
    return { ok: false, error: "No dollar amount. Write it like $10 or 10 dollars." };
  }
  const usd = toNumber(usdMatch[1]);
  if (!Number.isFinite(usd) || usd <= 0) {
    return { ok: false, error: "That amount does not look right." };
  }

  const symbol = findSymbol(text, usdMatch[0]);
  if (!symbol) {
    const listed = STOCKS.map((s) => s.symbol).join(", ");
    return { ok: false, error: `No stock we list. Try one of: ${listed}.` };
  }

  if (!handle && !pointsAtReplyTarget) {
    return { ok: false, error: "Who gets it? Tag a handle, or reply to them and write this person." };
  }

  return {
    ok: true,
    command: { handle, pointsAtReplyTarget, usd, symbol },
  };
}

function findSymbol(text: string, amountToken: string): string | null {
  const rest = text.replace(amountToken, " ");
  const words = rest
    .replace(/[^A-Za-z0-9$@_ ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const symbols = new Set(STOCKS.map((s) => s.symbol.toUpperCase()));
  const names = STOCKS.map((s) => ({ symbol: s.symbol, name: s.name.toLowerCase() }));

  // Prefer a cashtag or a bare ticker right after "of" / "in" / "worth of".
  const afterOf = rest.match(/\b(?:of|in)\s+\$?([A-Za-z]{1,6})\b/i);
  if (afterOf && symbols.has(afterOf[1].toUpperCase())) return afterOf[1].toUpperCase();

  for (const w of words) {
    if (w.startsWith("@")) continue;
    const token = w.replace(/^\$/, "").toUpperCase();
    if (symbols.has(token)) return token;
  }

  // Company names, with handles stripped so @usegivest never reads as GIVEST.
  const lower = rest.replace(HANDLE_RE, " ").toLowerCase();
  for (const { symbol, name } of names) {
    if (!name) continue;
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return symbol;
  }
  return null;
}

/** Where /send should open for a parsed command. */
export function sendHrefFor(command: XCommand): string {
  const params = new URLSearchParams();
  params.set("s", command.symbol);
  params.set("u", String(command.usd));
  if (command.handle) params.set("to", command.handle);
  return `/send?${params.toString()}`;
}
