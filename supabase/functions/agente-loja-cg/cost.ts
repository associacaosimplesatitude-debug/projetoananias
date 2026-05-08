const PRICING: Record<string, { input_per_mtok_usd: number; output_per_mtok_usd: number }> = {
  "claude-sonnet-4-5-20250929": {
    input_per_mtok_usd: 3.0,
    output_per_mtok_usd: 15.0,
  },
};

export function calcularCustoUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICING[model] || PRICING["claude-sonnet-4-5-20250929"];
  const inUsd = (tokensIn / 1_000_000) * p.input_per_mtok_usd;
  const outUsd = (tokensOut / 1_000_000) * p.output_per_mtok_usd;
  return Math.round((inUsd + outUsd) * 10000) / 10000;
}
