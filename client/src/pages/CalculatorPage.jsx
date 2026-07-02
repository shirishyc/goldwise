import { useState, useEffect } from 'react';
import { Calculator, RefreshCw } from 'lucide-react';
import { getLiveRates } from '../lib/api';
import { formatINR } from '../lib/utils';

export default function CalculatorPage() {
  const [rates, setRates] = useState(null);
  const [karat, setKarat] = useState('22');
  const [weight, setWeight] = useState(10);
  const [makingPercent, setMakingPercent] = useState(12);
  const [gst, setGst] = useState(3);

  useEffect(() => {
    getLiveRates().then(setRates).catch(() => {});
  }, []);

  const karatKey = `per_gram_${karat}k`;
  const ratePerGram = rates?.inr?.[karatKey] || 0;

  const baseValue = weight * ratePerGram;
  const makingCharges = baseValue * (makingPercent / 100);
  const gstAmount = (baseValue + makingCharges) * (gst / 100);
  const totalAmount = baseValue + makingCharges + gstAmount;

  const effectivePremium = ratePerGram > 0
    ? Math.round(((totalAmount / weight - ratePerGram) / ratePerGram) * 100 * 100) / 100
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Gold Cost Calculator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calculate the exact all-in price with making charges and GST before you buy
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gold Purity</label>
            <div className="flex gap-2 mt-1">
              {['24', '22', '18', '14'].map(k => (
                <button
                  key={k}
                  onClick={() => setKarat(k)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    karat === k ? 'bg-primary text-white' : 'bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  {k}K
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Rate: {formatINR(ratePerGram)}/g
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Weight (grams)
            </label>
            <input
              type="number"
              value={weight}
              onChange={e => setWeight(Math.max(0.1, parseFloat(e.target.value) || 0))}
              step="0.5"
              min="0.1"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm bg-background"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Making Charges (%)
            </label>
            <input
              type="number"
              value={makingPercent}
              onChange={e => setMakingPercent(Math.max(0, parseFloat(e.target.value) || 0))}
              step="1"
              min="0"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm bg-background"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GST (%)</label>
            <div className="flex gap-2 mt-1">
              {[3, 5, 12, 18].map(g => (
                <button
                  key={g}
                  onClick={() => setGst(g)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    gst === g ? 'bg-primary text-white' : 'bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  {g}%
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Gold rate: {formatINR(ratePerGram)}/g ({karat}K) — updated live from GoodReturns
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cost Breakdown</h2>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Base Value ({weight}g × {formatINR(ratePerGram)})</span>
              <span className="text-sm font-semibold">{formatINR(baseValue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Making Charges ({makingPercent}%)</span>
              <span className="text-sm font-semibold">{formatINR(makingCharges)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">GST ({gst}%)</span>
              <span className="text-sm font-semibold">{formatINR(gstAmount)}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-base font-bold">Total Amount</span>
              <span className="text-lg font-bold text-primary">{formatINR(totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Effective Premium</span>
              <span className={`text-sm font-semibold ${effectivePremium < 12 ? 'text-green-600' : 'text-red-600'}`}>
                {effectivePremium.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Price per Gram</span>
              <span className="text-sm font-semibold">{formatINR(totalAmount / weight)}</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              💡 A value investor targets below 12% premium. Under 3% is exceptional.
              Negative means you're paying below market rate — extremely rare.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
