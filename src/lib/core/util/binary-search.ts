/** Index of the last element <= value in a sorted array prefix of `length`, or -1. */
export function lastLessOrEqual(arr: Float64Array, length: number, value: number): number {
  let lo = 0;
  let hi = length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! <= value) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** Index of the first element >= value, or `length` when none. */
export function firstGreaterOrEqual(arr: Float64Array, length: number, value: number): number {
  let lo = 0;
  let hi = length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
