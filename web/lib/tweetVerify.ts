/**
 * Reads a public tweet without any X API credentials, using X's public
 * syndication endpoint (the one that powers embedded tweets) with
 * fxtwitter as a fallback. Used to verify recipient-locked claims:
 * the recipient proves control of a handle by posting a short code.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type PublicTweet = {
  handle: string;
  text: string;
  /** Handle of the account this post replies to, when X exposes it. */
  replyingTo: string | null;
};

export function extractTweetId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)((x|twitter)\.com)$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/status(?:es)?\/(\d{5,25})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Token derivation used by X's own embed widget. */
function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

async function fromSyndication(id: string): Promise<PublicTweet | null> {
  try {
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${syndicationToken(id)}&lang=en`,
      { headers: { "User-Agent": UA }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      user?: { screen_name?: string };
      text?: string;
      in_reply_to_screen_name?: string;
      parent?: { user?: { screen_name?: string } };
    };
    if (!json?.user?.screen_name || typeof json.text !== "string") return null;
    const replyingTo =
      json.in_reply_to_screen_name ?? json.parent?.user?.screen_name ?? null;
    return { handle: json.user.screen_name, text: json.text, replyingTo };
  } catch {
    return null;
  }
}

async function fromFxTwitter(id: string): Promise<PublicTweet | null> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${id}`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      tweet?: {
        text?: string;
        author?: { screen_name?: string };
        replying_to?: string | null;
      };
    };
    const t = json?.tweet;
    if (!t?.author?.screen_name || typeof t.text !== "string") return null;
    return {
      handle: t.author.screen_name,
      text: t.text,
      replyingTo: t.replying_to ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchPublicTweet(id: string): Promise<PublicTweet | null> {
  return (await fromSyndication(id)) ?? (await fromFxTwitter(id));
}
