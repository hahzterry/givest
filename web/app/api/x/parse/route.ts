import { NextResponse } from "next/server";
import { extractTweetId, fetchPublicTweet } from "@/lib/tweetVerify";
import { parseXCommand, sendHrefFor } from "@/lib/xCommand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reads a Givest send command from X.
 *
 * Body: { input: string }
 *   input is either a link to a post on X, or the command text itself.
 *
 * We read the public post, pull out who, how much, and which stock, and
 * hand back where /send should open. Nothing is sent from here.
 */
export async function POST(req: Request) {
  let body: { input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) {
    return NextResponse.json({ error: "Paste a post link or write the command." }, { status: 400 });
  }
  if (input.length > 2000) {
    return NextResponse.json({ error: "That is too long." }, { status: 400 });
  }

  const tweetId = extractTweetId(input);
  let text = input;
  let author: string | null = null;
  let replyingTo: string | null = null;

  if (tweetId) {
    const tweet = await fetchPublicTweet(tweetId);
    if (!tweet) {
      return NextResponse.json(
        { error: "Could not read that post. It may be private, deleted, or X is slow. Paste the text instead." },
        { status: 502 },
      );
    }
    text = tweet.text;
    author = tweet.handle;
    replyingTo = tweet.replyingTo;
  }

  const parsed = parseXCommand(text, replyingTo);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, text, author, replyingTo }, { status: 422 });
  }

  return NextResponse.json({
    command: parsed.command,
    sendHref: sendHrefFor(parsed.command),
    text,
    author,
    replyingTo,
    source: tweetId ? "post" : "text",
  });
}
