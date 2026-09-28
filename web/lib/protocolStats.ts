import { formatEther, type Address, type Hex } from "viem";
import { ESCROW_ADDRESSES, STOCKS, stockByAddress } from "@/lib/config";
import { publicClient } from "@/lib/chain";
import { readEthUsd, readUsdPrice } from "@/lib/prices";

/**
 * Volume is read from Robinhood Chain itself.
 * Blockscout sits behind a Cloudflare challenge and was returning
 * empty data, which the page then showed as $0.
 *
 * A cold server walks DropCreated logs once. After that it only asks
 * for blocks since the last read, reprices, and keeps the previous
 * numbers if a refresh fails.
 */

/** First block we scan. The earliest known create sits above this. */
const SCAN_FROM_BLOCK = 8_000_000n;
/**
 * One address plus one topic may span 10_000_000 blocks on this RPC.
 * Stay under that.
 */
const CHUNK_BLOCKS = 9_000_000n;
const QUERY_CONCURRENCY = 16;

/** DropCreated topic0 hashes across contract versions. */
const DROP_CREATED_TOPICS: Hex[] = [
  "0xa2a53c81e062881c7ba3d9296436d3042e66f4c2a2a721a714e42415a2bd6718",
  "0xcb54899c00dd633981d408fc7d967edd5447f66cec4a623465e92e6548a60f3f",
  "0xb2d083359c28e01231c2b574a882fb62468cdd0d9aff0525edc5d6da513e5d7b",
];

/**
 * Extra price feeds for historical drops whose tickers are no longer
 * on the send list. Used only for stats.
 */
const HISTORICAL_FEEDS: Record<string, Address> = {
  "0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a":
    "0x820ABedFF239034956B7A9d2F0a331f9F075eB4c", // PLTR
  "0x6330d8c3178a418788df01a47479c0ce7ccf450b":
    "0xA3a468A452940B7D6b69991207B508c609a98Ef2", // COIN
  "0x86923f96303d656e4aa86d9d42d1e57ad2023fdc":
    "0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72", // AMD
  "0xb0992820e760d836549ba69bc7598b4af75dee03":
    "0x0e6a64a2B58A6693a531E6c555f3A5d042eEA844", // ORCL
  "0x5f10a1c971b69e47e059e1dc91901b59b3fb49c3":
    "0xe1b3aABCAFAd1c94708dc1367dcfF8Aa4407487C", // CRWV
  "0xc72b96e0e48ecd4dc75e1e45396e26300bc39681":
    "0x3f390C5C24628Ac7C489515402235FeAD71D1913", // INTC
  "0xb90a19ff0af67f7779aff50a882a9cff42446400":
    "0xfb133Fa4B7b385802B693a293606682Df47109A3", // SNDK
};

type RpcLog = {
  transactionHash?: Hex;
  logIndex?: Hex;
  blockNumber?: Hex;
  topics?: Hex[];
  data?: Hex;
};

type DropLog = {
  key: string;
  txHash: Hex;
  token: Address;
  shares: number;
  ethWei: bigint;
};

export type ProtocolStats = {
  /** USD of ETH that entered the protocol on create. */
  volumeUsd: number;
  /** USD of stock tokens locked in escrow at the current price. */
  stockVolumeUsd: number;
  dropCount: number;
  pricedDropCount: number;
  /** Unix ms of this read. */
  updatedAt: number;
};

type Snapshot = {
  at: number;
  scannedTo: bigint;
  logs: DropLog[];
  stats: ProtocolStats;
};

const CACHE_FRESH_MS = 12_000;

const memory = globalThis as typeof globalThis & {
  __givestProtocolStats?: Snapshot;
  __givestProtocolInflight?: Promise<ProtocolStats> | null;
};

function hexToBig(hex: string | undefined): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

async function getLogsChunk(
  address: Address,
  topic: Hex,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<RpcLog[]> {
  const run = () =>
    publicClient.request({
      method: "eth_getLogs",
      params: [
        {
          address,
          topics: [topic],
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`,
        },
      ],
    }) as Promise<RpcLog[]>;

  try {
    return await run();
  } catch {
    return await run();
  }
}

/** Every DropCreated between the two blocks, across escrow versions. */
async function fetchDropLogs(fromBlock: bigint, toBlock: bigint): Promise<RpcLog[]> {
  if (fromBlock > toBlock) return [];

  const jobs: Array<() => Promise<RpcLog[]>> = [];
  for (const address of ESCROW_ADDRESSES) {
    for (const topic of DROP_CREATED_TOPICS) {
      for (let from = fromBlock; from <= toBlock; ) {
        const to =
          from + CHUNK_BLOCKS - 1n > toBlock ? toBlock : from + CHUNK_BLOCKS - 1n;
        const start = from;
        jobs.push(() => getLogsChunk(address, topic, start, to));
        from = to + 1n;
      }
    }
  }

  const logs: RpcLog[] = [];
  for (let i = 0; i < jobs.length; i += QUERY_CONCURRENCY) {
    const batch = await Promise.all(jobs.slice(i, i + QUERY_CONCURRENCY).map((job) => job()));
    for (const rows of batch) logs.push(...rows);
  }
  return logs;
}

function decodeDrop(log: RpcLog, ethByTx: Map<string, bigint>): DropLog | null {
  const topics = log.topics ?? [];
  const txHash = log.transactionHash;
  if (!txHash || topics.length < 4) return null;
  const data = (log.data ?? "0x").slice(2);
  if (data.length < 64) return null;
  const token = `0x${topics[3].slice(-40)}` as Address;
  const shares = Number(formatEther(BigInt(`0x${data.slice(0, 64)}`)));
  const key = `${txHash}:${log.logIndex ?? "0x0"}`;
  return {
    key,
    txHash,
    token,
    shares: Number.isFinite(shares) && shares > 0 ? shares : 0,
    ethWei: ethByTx.get(txHash.toLowerCase()) ?? 0n,
  };
}

async function ethByTransaction(hashes: Hex[]): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  const unique = [...new Set(hashes.map((h) => h.toLowerCase() as Hex))];
  for (let i = 0; i < unique.length; i += QUERY_CONCURRENCY) {
    const slice = unique.slice(i, i + QUERY_CONCURRENCY);
    const txs = await Promise.all(
      slice.map((hash) => publicClient.getTransaction({ hash })),
    );
    for (const tx of txs) out.set(tx.hash.toLowerCase(), tx.value);
  }
  return out;
}

async function priceFor(
  token: Address,
  cache: Map<string, number | null>,
): Promise<number | null> {
  const key = token.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const stock = stockByAddress(token);
  const feed = stock?.feed ?? HISTORICAL_FEEDS[key] ?? null;
  if (!feed) {
    cache.set(key, null);
    return null;
  }
  const price = await readUsdPrice(feed);
  cache.set(key, price);
  return price;
}

async function buildStats(logs: DropLog[], previous: ProtocolStats | null): Promise<ProtocolStats> {
  const priceCache = new Map<string, number | null>();
  await Promise.all(STOCKS.filter((s) => s.feed).map((s) => priceFor(s.address, priceCache)));

  let stockVolumeUsd = 0;
  let pricedDropCount = 0;
  let ethWei = 0n;
  const seenTx = new Set<string>();

  for (const log of logs) {
    const tx = log.txHash.toLowerCase();
    if (!seenTx.has(tx)) {
      seenTx.add(tx);
      ethWei += log.ethWei;
    }
    if (log.shares <= 0) continue;
    const price = await priceFor(log.token, priceCache);
    if (price === null) continue;
    stockVolumeUsd += log.shares * price;
    pricedDropCount += 1;
  }

  const ethUsd = await readEthUsd();
  const eth = Number(formatEther(ethWei));
  const volumeUsd =
    ethUsd && ethUsd > 0
      ? eth * ethUsd
      : (previous?.volumeUsd ?? 0);

  if (logs.length === 0) {
    throw new Error("chain returned no drops");
  }
  if ((!ethUsd || ethUsd <= 0) && !previous) {
    throw new Error("eth price unavailable");
  }

  return {
    volumeUsd,
    stockVolumeUsd,
    dropCount: logs.length,
    pricedDropCount,
    updatedAt: Date.now(),
  };
}

async function computeProtocolStats(): Promise<ProtocolStats> {
  const previous = memory.__givestProtocolStats ?? null;
  const latest = await publicClient.getBlockNumber();
  const from = previous ? previous.scannedTo + 1n : SCAN_FROM_BLOCK;
  const freshLogs = await fetchDropLogs(from, latest);

  const known = new Set((previous?.logs ?? []).map((l) => l.key));
  const unseen = freshLogs.filter((l) => {
    const key = `${l.transactionHash}:${l.logIndex ?? "0x0"}`;
    return l.transactionHash && !known.has(key);
  });
  const ethByTx = await ethByTransaction(
    unseen.map((l) => l.transactionHash).filter((h): h is Hex => Boolean(h)),
  );

  const decoded = unseen
    .map((l) => decodeDrop(l, ethByTx))
    .filter((l): l is DropLog => l !== null);

  const logs = [...(previous?.logs ?? []), ...decoded];
  const stats = await buildStats(logs, previous?.stats ?? null);

  memory.__givestProtocolStats = {
    at: Date.now(),
    scannedTo: latest,
    logs,
    stats,
  };
  return stats;
}

function refresh(): Promise<ProtocolStats> {
  memory.__givestProtocolInflight ??= computeProtocolStats()
    .finally(() => {
      memory.__givestProtocolInflight = null;
    });
  return memory.__givestProtocolInflight;
}

/**
 * Reads the chain at least every few seconds.
 * A failed or slow read keeps the last good numbers. It never becomes $0.
 */
export async function getProtocolStats(maxWaitMs = 8_000): Promise<ProtocolStats> {
  const snap = memory.__givestProtocolStats;
  const fresh = snap && Date.now() - snap.at < CACHE_FRESH_MS;
  if (fresh) return snap.stats;

  const promise = refresh();
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("protocol stats timed out")), maxWaitMs),
      ),
    ]);
  } catch (e) {
    if (snap) return snap.stats;
    throw e;
  }
}

export function formatVolumeUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 100) return `$${Math.round(n)}`;
  return `$${n.toFixed(0)}`;
}
