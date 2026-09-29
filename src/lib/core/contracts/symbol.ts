/** Static metadata about a tradable instrument. */
export interface SymbolInfo {
  readonly symbol: string;
  readonly description: string;
  /** Minimum price movement. */
  readonly tickSize: number;
  /** Decimals used to display prices. */
  readonly pricePrecision: number;
  /** Minimum quantity step (lot size). */
  readonly qtyStep: number;
  readonly quoteCurrency: string;
  readonly baseCurrency: string;
}
