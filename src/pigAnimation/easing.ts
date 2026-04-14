export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function window01(t: number, a: number, b: number): number {
  if (t <= a || b <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
}
