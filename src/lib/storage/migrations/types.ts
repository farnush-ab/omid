import type { RecordKind } from '../envelope';

/**
 * One pure, forward-only step. Migrations describe historical shapes with local types and must
 * never import current domain types (those will change; the history must not).
 */
export interface Migration {
  readonly kind: RecordKind;
  readonly from: number;
  readonly to: number;
  readonly description: string;
  migrate(data: unknown): unknown;
}
