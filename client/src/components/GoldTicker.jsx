import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingBag, Coins, BarChart3, Calculator } from 'lucide-react';

export default function GoldTicker({ rates }) {
  if (!rates) return <div className="bg-primary-950 h-7" />;

  const items = [
    { label: 'XAU/USD', value: `$${rates.xauUsd?.perGram?.toFixed(0) || 0}/g`, sub: `$${(rates.xauUsd?.perOz || 0).toFixed(0)}/oz` },
    { label: 'GoodReturns', karat: '24K', value: `₹${rates.inr?.per_gram_24k || 0}/g` },
    { label: '', karat: '22K', value: `₹${rates.inr?.per_gram_22k || 0}/g` },
    { label: '', karat: '18K', value: `₹${rates.inr?.per_gram_18k || 0}/g` },
    { label: 'MCX', karat: '24K', value: `₹${rates.mcx?.per_gram_24k || 0}/g` },
    { label: '', karat: '22K', value: `₹${rates.mcx?.per_gram_22k || 0}/g` },
    { label: 'USD/INR', value: `₹${rates.usdInr || 95}` },
  ];

  return (
    <div className="bg-primary-950 overflow-hidden h-7 flex items-center">
      <div className="animate-marquee whitespace-nowrap flex">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-4">
            {item.label && (
              <span className="text-amber-400 text-[11px] font-bold">{item.label}</span>
            )}
            {item.karat && (
              <span className="text-amber-300/60 text-[10px]">{item.karat}</span>
            )}
            <span className="text-white text-[11px] font-semibold tabular-nums">{item.value}</span>
            {i < items.length * 2 - 1 && (
              <span className="text-amber-600 text-[10px] select-none ml-1">◆</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
