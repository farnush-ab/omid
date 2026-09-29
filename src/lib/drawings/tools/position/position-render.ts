import { decimalsOf, drawLabel, formatNumber, formatPercent, withOpacity } from '@/lib/core';
import type { DrawingContext } from '../../framework';
import type { PositionLevels, PositionOutcome, PositionStats, Side } from './position-math';
import type { PositionStyle } from './style';

export interface PositionView {
  readonly side: Side;
  readonly style: PositionStyle;
  readonly geometry: { x1: number; x2: number; yEntry: number; yTarget: number; yStop: number };
  readonly stats: PositionStats;
  readonly outcome: PositionOutcome;
  readonly levels: PositionLevels;
  readonly showStats: boolean;
}

const LABEL_FONT = '12px Inter, system-ui, sans-serif';
const LABEL_GAP = 14;
const TRADE_ZONE_BOOST = 1.9;

const STATUS_TEXT: Record<PositionOutcome['status'], string> = {
  waiting: 'Waiting for entry',
  open: 'Open',
  win: 'Target hit',
  loss: 'Stop hit',
  closed: 'Closed',
};

/** Draws zones, the realised trade path, the three labels and optional axis price labels. */
export function renderPosition(
  ctx: CanvasRenderingContext2D,
  dc: DrawingContext,
  v: PositionView,
): void {
  const { style: s, geometry: g } = v;
  const left = Math.min(g.x1, g.x2);
  const width = Math.max(1, Math.abs(g.x2 - g.x1));
  const zone = (y1: number, y2: number, color: string, opacity: number) => {
    ctx.fillStyle = withOpacity(color, opacity);
    ctx.fillRect(left, Math.min(y1, y2), width, Math.abs(y2 - y1));
  };
  zone(g.yEntry, g.yTarget, s.profitColor, s.profitOpacity);
  zone(g.yEntry, g.yStop, s.lossColor, s.lossOpacity);
  renderTrade(ctx, dc, v, left);

  ctx.setLineDash([]);
  ctx.lineWidth = s.lineWidth;
  ctx.strokeStyle = s.lineColor;
  ctx.beginPath();
  ctx.moveTo(left, g.yEntry);
  ctx.lineTo(left + width, g.yEntry);
  ctx.stroke();
  ctx.strokeStyle = withOpacity(s.profitColor, 0.9);
  ctx.beginPath();
  ctx.moveTo(left, g.yTarget);
  ctx.lineTo(left + width, g.yTarget);
  ctx.stroke();
  ctx.strokeStyle = withOpacity(s.lossColor, 0.9);
  ctx.beginPath();
  ctx.moveTo(left, g.yStop);
  ctx.lineTo(left + width, g.yStop);
  ctx.stroke();

  if (v.showStats) renderLabels(ctx, dc, v, left + width / 2);
  if (s.showPriceLabels) renderAxisLabels(ctx, dc, v);
}

function renderTrade(
  ctx: CanvasRenderingContext2D,
  dc: DrawingContext,
  v: PositionView,
  left: number,
): void {
  const o = v.outcome;
  if (o.entryIndex === null || o.markPrice === null) return;
  const c = dc.coords;
  const xEntry = Math.max(left, c.indexToX(o.entryIndex));
  const xEnd = c.indexToX(o.exitIndex ?? dc.data.length - 1);
  const yMark = c.priceToY(o.markPrice);
  const profit = o.pnlPerUnit >= 0;
  const color = profit ? v.style.profitColor : v.style.lossColor;
  const opacity = Math.min(
    0.85,
    (profit ? v.style.profitOpacity : v.style.lossOpacity) * TRADE_ZONE_BOOST,
  );
  ctx.fillStyle = withOpacity(color, opacity);
  ctx.fillRect(
    xEntry,
    Math.min(v.geometry.yEntry, yMark),
    Math.max(1, xEnd - xEntry),
    Math.abs(yMark - v.geometry.yEntry),
  );
  ctx.strokeStyle = withOpacity(v.style.textColor, 0.8);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(xEntry, v.geometry.yEntry);
  ctx.lineTo(xEnd, yMark);
  ctx.stroke();
  ctx.setLineDash([]);
}

function renderLabels(
  ctx: CanvasRenderingContext2D,
  dc: DrawingContext,
  v: PositionView,
  cx: number,
): void {
  const { stats: st, style: s, outcome: o, geometry: g } = v;
  const prec = dc.symbol.pricePrecision;
  const money = (x: number) => formatNumber(x, 2);
  const qty = formatNumber(st.quantity, decimalsOf(dc.symbol.qtyStep));
  const targetAbove = g.yTarget < g.yStop;
  const targetText = s.compact
    ? formatPercent(st.targetPercent)
    : `Target: ${st.targetDistance.toFixed(prec)} (${formatPercent(st.targetPercent)}) ${st.targetTicks}, Amount: ${money(st.targetPnl)}`;
  const stopText = s.compact
    ? formatPercent(-st.stopPercent)
    : `Stop: ${st.stopDistance.toFixed(prec)} (${formatPercent(st.stopPercent)}) ${st.stopTicks}, Amount: ${money(Math.abs(st.stopPnl))}`;
  const pnl = o.pnlPerUnit * st.quantity;
  const rr = st.riskReward.toFixed(2);
  let middle: string;
  if (o.status === 'waiting')
    middle = s.compact
      ? `R:R ${rr}`
      : `${STATUS_TEXT.waiting} · Qty: ${qty} · Risk/Reward Ratio: ${rr}`;
  else if (o.status === 'open')
    middle = `Open P&L: ${money(pnl)}${s.compact ? '' : `, Qty: ${qty}, Risk/Reward Ratio: ${rr}`}`;
  else
    middle = `${STATUS_TEXT[o.status]} · Closed P&L: ${money(pnl)}${s.compact ? '' : `, Qty: ${qty}`}`;

  const opts = (bg: string) => ({
    bg,
    fg: s.textColor,
    font: LABEL_FONT,
    align: 'center' as const,
    radius: 3,
  });
  const yT = targetAbove
    ? Math.min(g.yTarget, g.yStop) - LABEL_GAP
    : Math.max(g.yTarget, g.yStop) + LABEL_GAP;
  const yS = targetAbove
    ? Math.max(g.yTarget, g.yStop) + LABEL_GAP
    : Math.min(g.yTarget, g.yStop) - LABEL_GAP;
  drawLabel(ctx, targetText, cx, yT, opts(s.profitLabelColor));
  drawLabel(ctx, stopText, cx, yS, opts(s.lossLabelColor));
  const midBg =
    o.status === 'win' || (o.status !== 'loss' && pnl > 0)
      ? s.profitLabelColor
      : o.status === 'waiting'
        ? s.lineColor
        : s.lossLabelColor;
  drawLabel(ctx, middle, cx, g.yEntry, opts(midBg));
}

function renderAxisLabels(
  ctx: CanvasRenderingContext2D,
  dc: DrawingContext,
  v: PositionView,
): void {
  const x = dc.pane.x + dc.pane.width - 2;
  const l = v.levels;
  const fg = v.style.textColor;
  const opts = (bg: string) => ({ bg, fg, font: LABEL_FONT, align: 'right' as const, radius: 2 });
  drawLabel(ctx, dc.formatPrice(l.target), x, v.geometry.yTarget, opts(v.style.profitLabelColor));
  drawLabel(ctx, dc.formatPrice(l.stop), x, v.geometry.yStop, opts(v.style.lossLabelColor));
  drawLabel(ctx, dc.formatPrice(l.entry), x, v.geometry.yEntry, opts(v.style.lineColor));
}
