export function formatINR(num) {
  if (num == null || isNaN(num)) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
}

export function formatUSD(num) {
  if (num == null || isNaN(num)) return '$0';
  return '$' + Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatKarat(karat) {
  return `${karat}K`;
}

export function premiumColor(pct) {
  if (pct == null || isNaN(pct)) return 'text-muted-foreground';
  if (pct < 3) return 'text-green-600 font-bold';
  if (pct < 8) return 'text-emerald-600';
  if (pct < 12) return 'text-amber-600';
  return 'text-red-600';
}

export function premiumLabel(pct) {
  if (pct == null || isNaN(pct)) return 'N/A';
  if (pct < 0) return 'Below Spot ✦';
  if (pct < 3) return 'Exceptional ⭐';
  if (pct < 8) return 'Value Pick';
  if (pct < 12) return 'Good Pick';
  return 'Market Rate';
}

export function getGoldRateForKarat(rates, karat) {
  if (!rates) return 0;
  const key = `per_gram_${karat}k`.toLowerCase();
  return rates[key] || rates[`per_gram_${karat}`] || 0;
}
