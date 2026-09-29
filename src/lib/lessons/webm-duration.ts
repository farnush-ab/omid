/**
 * MediaRecorder writes WebM files without a Duration, which makes browsers report
 * `duration = Infinity` and seek slowly or not at all. This patches the Segment > Info element
 * in place (or inserts a Duration) — a minimal EBML editor, no dependencies.
 */

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_CLUSTER = 0x1f43b675;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;

interface Vint {
  readonly value: number;
  readonly length: number;
  readonly unknown: boolean;
}

function readVint(b: Uint8Array, pos: number, keepMarker: boolean): Vint | null {
  const first = b[pos];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
  if (length > 8 || pos + length > b.length) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  let allOnes = (first & (0xff >> length)) === 0xff >> length;
  for (let i = 1; i < length; i++) {
    value = value * 256 + b[pos + i]!;
    if (b[pos + i] !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !keepMarker && allOnes };
}

interface Element {
  readonly id: number;
  readonly start: number;
  readonly sizeAt: number;
  readonly sizeLength: number;
  readonly dataStart: number;
  /** Data size; -1 when unknown. */
  readonly size: number;
}

function readElement(b: Uint8Array, pos: number): Element | null {
  const id = readVint(b, pos, true);
  if (!id) return null;
  const size = readVint(b, pos + id.length, false);
  if (!size) return null;
  return {
    id: id.value,
    start: pos,
    sizeAt: pos + id.length,
    sizeLength: size.length,
    dataStart: pos + id.length + size.length,
    size: size.unknown ? -1 : size.value,
  };
}

function encodeSize(value: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = v % 256;
    v = Math.floor(v / 256);
  }
  out[0]! |= 0x80 >> (length - 1);
  return out;
}

function readUint(b: Uint8Array, start: number, size: number): number {
  let v = 0;
  for (let i = 0; i < size; i++) v = v * 256 + b[start + i]!;
  return v;
}

/** Returns a copy of `bytes` whose WebM Duration is `durationMs`; unknown input is returned as is. */
export function fixWebmDuration(bytes: Uint8Array, durationMs: number): Uint8Array {
  const header = readElement(bytes, 0);
  if (!header || header.id !== 0x1a45dfa3 || header.size < 0) return bytes;
  const segment = readElement(bytes, header.dataStart + header.size);
  if (!segment || segment.id !== ID_SEGMENT) return bytes;
  const segmentEnd = segment.size < 0 ? bytes.length : segment.dataStart + segment.size;

  let info: Element | null = null;
  for (let pos = segment.dataStart; pos < segmentEnd;) {
    const el = readElement(bytes, pos);
    if (!el || el.id === ID_CLUSTER || el.size < 0) break;
    if (el.id === ID_INFO) {
      info = el;
      break;
    }
    pos = el.dataStart + el.size;
  }
  if (!info) return bytes;

  let scale = 1_000_000;
  let duration: Element | null = null;
  const infoEnd = info.dataStart + info.size;
  for (let pos = info.dataStart; pos < infoEnd;) {
    const el = readElement(bytes, pos);
    if (!el || el.size < 0) break;
    if (el.id === ID_TIMECODE_SCALE) scale = readUint(bytes, el.dataStart, el.size) || scale;
    if (el.id === ID_DURATION) duration = el;
    pos = el.dataStart + el.size;
  }
  const value = (durationMs * 1_000_000) / scale;

  const out = new Uint8Array(bytes);
  if (duration && (duration.size === 8 || duration.size === 4)) {
    const view = new DataView(out.buffer, out.byteOffset + duration.dataStart, duration.size);
    if (duration.size === 8) view.setFloat64(0, value);
    else view.setFloat32(0, value);
    return out;
  }
  if (duration) return bytes;

  // Insert Duration (float64) at the end of Info, re-encoding Info's size with 8 bytes.
  const element = new Uint8Array(11);
  element.set([0x44, 0x89, 0x88]);
  new DataView(element.buffer).setFloat64(3, value);
  const newInfoSize = encodeSize(info.size + element.length, 8);
  const growth = element.length + newInfoSize.length - info.sizeLength;
  const result = new Uint8Array(bytes.length + growth);
  let w = 0;
  const copy = (from: number, to: number) => {
    result.set(bytes.subarray(from, to), w);
    w += to - from;
  };
  copy(0, info.sizeAt);
  result.set(newInfoSize, w);
  w += newInfoSize.length;
  copy(info.dataStart, infoEnd);
  result.set(element, w);
  w += element.length;
  copy(infoEnd, bytes.length);
  if (segment.size >= 0) {
    const max = 2 ** (7 * segment.sizeLength) - 2;
    const next = segment.size + growth;
    if (next > max) return bytes;
    result.set(encodeSize(next, segment.sizeLength), segment.sizeAt);
  }
  return result;
}

/** Reads the Duration (ms) of a WebM file, or null (tests / diagnostics). */
export function readWebmDuration(bytes: Uint8Array): number | null {
  const header = readElement(bytes, 0);
  if (!header || header.size < 0) return null;
  const segment = readElement(bytes, header.dataStart + header.size);
  if (!segment || segment.id !== ID_SEGMENT) return null;
  const end = segment.size < 0 ? bytes.length : segment.dataStart + segment.size;
  for (let pos = segment.dataStart; pos < end;) {
    const el = readElement(bytes, pos);
    if (!el || el.size < 0 || el.id === ID_CLUSTER) return null;
    if (el.id === ID_INFO) {
      let scale = 1_000_000;
      let raw: number | null = null;
      for (let p = el.dataStart; p < el.dataStart + el.size;) {
        const c = readElement(bytes, p);
        if (!c || c.size < 0) break;
        if (c.id === ID_TIMECODE_SCALE) scale = readUint(bytes, c.dataStart, c.size) || scale;
        if (c.id === ID_DURATION) {
          const view = new DataView(bytes.buffer, bytes.byteOffset + c.dataStart, c.size);
          raw = c.size === 8 ? view.getFloat64(0) : view.getFloat32(0);
        }
        p = c.dataStart + c.size;
      }
      return raw === null ? null : (raw * scale) / 1_000_000;
    }
    pos = el.dataStart + el.size;
  }
  return null;
}
