/** Same rule the server enforces for experiment tracking keys. */
export const TRACKING_KEY = /^[a-zA-Z0-9_.:-]{1,150}$/

const TOLERANCE = 0.0001

export function weightsAddUp(weights: number[]): boolean {
  return Math.abs(weights.reduce((sum, w) => sum + w, 0) - 1) <= TOLERANCE / 2
}

/** Even split rounded to 4 decimals; the last variation absorbs the rounding so the total is exactly 1. */
export function equalWeights(count: number): number[] {
  if (count <= 0) return []
  const each = Math.floor(10000 / count) / 10000
  const weights = Array.from({ length: count }, () => each)
  weights[count - 1] = Math.round((1 - each * (count - 1)) * 10000) / 10000
  return weights
}

/** GrowthBook-style numeric keys ("0", "1", ...); existing keys are never reused so analytics stay consistent. */
export function nextVariationKey(keys: string[]): string {
  const used = keys.map(Number).filter((n) => Number.isInteger(n) && n >= 0)
  return String(used.length === 0 ? 0 : Math.max(...used) + 1)
}
