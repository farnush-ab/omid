import { NextResponse, type NextRequest } from 'next/server';
import { getTimeframe, isTimeframeId, type BarsRequest } from '@/lib/core';
import {
  BINANCE_HOSTS,
  BINANCE_MAX_LIMIT,
  SyntheticProvider,
  klinesQuery,
  parseKlines,
} from '@/lib/data';

const LIVE_TTL_MS = 15_000;
const HISTORY_TTL_MS = 60 * 60_000;
const UPSTREAM_TIMEOUT_MS = 6_000;
const MAX_CACHE_ENTRIES = 500;
const SYMBOL_RE = /^[A-Z0-9]{2,20}$/;

interface CacheEntry {
  expires: number;
  body: { bars: unknown[]; source: string; hasMoreHistory: boolean };
}

/** Module-level LRU-ish cache shared by requests handled by this server instance. */
const cache = new Map<string, CacheEntry>();
const synthetic = new SyntheticProvider({ clock: { now: () => Date.now() } });

function num(v: string | null): number | undefined {
  if (v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

async function fromBinance(req: BarsRequest) {
  const query = klinesQuery(req).toString();
  let lastError: unknown = null;
  const hosts = process.env.BINANCE_BASE_URL ? [process.env.BINANCE_BASE_URL] : BINANCE_HOSTS;
  for (const host of hosts) {
    try {
      const res = await fetch(`${host}/api/v3/klines?${query}`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`${host} responded ${res.status}`);
      const bars = parseKlines(await res.json());
      if (!bars) throw new Error(`${host} returned malformed klines`);
      return { bars, source: 'binance', hasMoreHistory: bars.length === req.limit };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('No upstream available');
}

/** GET /api/klines?symbol=BTCUSDT&timeframe=1h&limit=1000[&startTime=&endTime=] */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const symbol = (p.get('symbol') ?? '').toUpperCase();
  const timeframe = p.get('timeframe');
  if (!SYMBOL_RE.test(symbol) || !isTimeframeId(timeframe)) {
    return NextResponse.json({ error: 'Invalid symbol or timeframe' }, { status: 400 });
  }
  const startTime = num(p.get('startTime'));
  const endTime = num(p.get('endTime'));
  const req: BarsRequest = {
    symbol,
    timeframe,
    limit: Math.min(BINANCE_MAX_LIMIT, Math.max(1, num(p.get('limit')) ?? 500)),
    ...(startTime !== undefined ? { startTime } : {}),
    ...(endTime !== undefined ? { endTime } : {}),
  };

  const now = Date.now();
  const key = request.nextUrl.search;
  const hit = cache.get(key);
  if (hit && hit.expires > now) {
    return NextResponse.json(hit.body, {
      headers: { 'x-data-source': hit.body.source, 'x-cache': 'HIT' },
    });
  }

  let body: CacheEntry['body'];
  try {
    body = await fromBinance(req);
  } catch (e) {
    console.warn(
      '[api/klines] upstream failed, serving synthetic data:',
      e instanceof Error ? e.message : e,
    );
    body = synthetic.generate(req);
  }
  const historical = endTime !== undefined && endTime < now - getTimeframe(timeframe).ms;
  if (body.source === 'binance') {
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: now + (historical ? HISTORY_TTL_MS : LIVE_TTL_MS), body });
  }
  return NextResponse.json(body, { headers: { 'x-data-source': body.source, 'x-cache': 'MISS' } });
}
