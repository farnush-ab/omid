import type { SymbolInfo } from '@/lib/core';
import { decimalsOf } from '@/lib/core';

interface SymbolSeed {
  symbol: string;
  description: string;
  tickSize: number;
  qtyStep: number;
  /** Reference price for synthetic data. */
  refPrice: number;
}

const SEEDS: readonly SymbolSeed[] = [
  {
    symbol: 'BTCUSDT',
    description: 'Bitcoin / TetherUS',
    tickSize: 0.01,
    qtyStep: 0.00001,
    refPrice: 62000,
  },
  {
    symbol: 'ETHUSDT',
    description: 'Ethereum / TetherUS',
    tickSize: 0.01,
    qtyStep: 0.0001,
    refPrice: 3100,
  },
  {
    symbol: 'BNBUSDT',
    description: 'BNB / TetherUS',
    tickSize: 0.01,
    qtyStep: 0.001,
    refPrice: 580,
  },
  {
    symbol: 'SOLUSDT',
    description: 'Solana / TetherUS',
    tickSize: 0.01,
    qtyStep: 0.001,
    refPrice: 150,
  },
  {
    symbol: 'XRPUSDT',
    description: 'XRP / TetherUS',
    tickSize: 0.0001,
    qtyStep: 0.1,
    refPrice: 0.6,
  },
  {
    symbol: 'ADAUSDT',
    description: 'Cardano / TetherUS',
    tickSize: 0.0001,
    qtyStep: 0.1,
    refPrice: 0.45,
  },
  {
    symbol: 'DOGEUSDT',
    description: 'Dogecoin / TetherUS',
    tickSize: 0.00001,
    qtyStep: 1,
    refPrice: 0.12,
  },
  {
    symbol: 'AVAXUSDT',
    description: 'Avalanche / TetherUS',
    tickSize: 0.01,
    qtyStep: 0.01,
    refPrice: 32,
  },
  {
    symbol: 'LINKUSDT',
    description: 'Chainlink / TetherUS',
    tickSize: 0.001,
    qtyStep: 0.01,
    refPrice: 15,
  },
  {
    symbol: 'DOTUSDT',
    description: 'Polkadot / TetherUS',
    tickSize: 0.001,
    qtyStep: 0.01,
    refPrice: 6.5,
  },
  {
    symbol: 'LTCUSDT',
    description: 'Litecoin / TetherUS',
    tickSize: 0.01,
    qtyStep: 0.001,
    refPrice: 80,
  },
  {
    symbol: 'TRXUSDT',
    description: 'TRON / TetherUS',
    tickSize: 0.00001,
    qtyStep: 0.1,
    refPrice: 0.13,
  },
];

function toInfo(s: SymbolSeed): SymbolInfo {
  const quote = s.symbol.endsWith('USDT') ? 'USDT' : s.symbol.slice(-3);
  return {
    symbol: s.symbol,
    description: s.description,
    tickSize: s.tickSize,
    pricePrecision: decimalsOf(s.tickSize),
    qtyStep: s.qtyStep,
    quoteCurrency: quote,
    baseCurrency: s.symbol.slice(0, s.symbol.length - quote.length),
  };
}

export const SYMBOLS: readonly SymbolInfo[] = SEEDS.map(toInfo);

export function referencePrice(symbol: string): number {
  return SEEDS.find((s) => s.symbol === symbol)?.refPrice ?? 100;
}

/** Catalogue lookup; unknown symbols get sensible defaults (2 decimals, USDT quote). */
export function symbolInfo(symbol: string): SymbolInfo {
  const upper = symbol.toUpperCase();
  const known = SYMBOLS.find((s) => s.symbol === upper);
  if (known) return known;
  return toInfo({
    symbol: upper,
    description: upper,
    tickSize: 0.01,
    qtyStep: 0.001,
    refPrice: 100,
  });
}

export function searchSymbols(query: string): SymbolInfo[] {
  const q = query.trim().toUpperCase();
  if (!q) return [...SYMBOLS];
  return SYMBOLS.filter((s) => s.symbol.includes(q) || s.description.toUpperCase().includes(q));
}
