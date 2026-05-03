/**
 * Thompson Sampling helpers for the multi-armed bandit. We sample from a
 * Beta(α, β) distribution per variant where α = 1 + conversions and β = 1 +
 * (impressions − conversions). The variant with the highest sampled value
 * gets the next impression. Over time, traffic concentrates on winners but
 * still explores everything else thanks to the random sampling.
 */

function randomNormal(): number {
  // Box-Muller transform — Math.random() doesn't give Gaussian variates.
  const u1 = Math.max(Math.random(), 1e-10);
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Marsaglia & Tsang's method for sampling from Gamma(shape, 1). */
function gammaSample(shape: number): number {
  if (shape < 1) {
    // Boost trick: Gamma(α) = Gamma(α + 1) * U^(1/α)
    return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      x = randomNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Sample a value from Beta(alpha, beta). */
export function sampleBeta(alpha: number, beta: number): number {
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

export interface VariantStats {
  impressions: number;
  conversions: number;
}

/**
 * Pick a variant index using Thompson Sampling. With no prior data the
 * Beta(1, 1) prior is uniform, so all variants are equally likely. As
 * conversions accumulate the winning variant gets exponentially more
 * traffic — but losing variants keep getting some exploration.
 */
export function pickByThompsonSampling<T>(
  variants: { id: string; data: T }[],
  statsByVariantId: Map<string, VariantStats>,
): { id: string; data: T } {
  if (variants.length === 0) throw new Error("pickByThompsonSampling: empty variants");
  if (variants.length === 1) return variants[0];

  let best = variants[0];
  let bestSample = -1;
  for (const v of variants) {
    const s = statsByVariantId.get(v.id) || { impressions: 0, conversions: 0 };
    const wins = s.conversions;
    const losses = Math.max(0, s.impressions - s.conversions);
    const sample = sampleBeta(1 + wins, 1 + losses);
    if (sample > bestSample) {
      bestSample = sample;
      best = v;
    }
  }
  return best;
}
