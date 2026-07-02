import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getPulse } from '../lib/api';
import { formatINR, formatUSD } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, CartesianGrid } from 'recharts';

export default function PulsePage() {
  const [pulse, setPulse] = useState(null);

  useEffect(() => {
    getPulse().then(setPulse).catch(() => {});
    const interval = setInterval(() => getPulse().then(setPulse).catch(() => {}), 300000);
    return () => clearInterval(interval);
  }, []);

  if (!pulse || !pulse.price) {
    return (
      <div className="text-center py-12">
        <h1 className="font-serif text-2xl font-bold mb-2">Gold Market Pulse</h1>
        <p className="text-muted-foreground">Loading market data... First scrape completes within a few minutes.</p>
      </div>
    );
  }

  const SignalIcon = ({ signal }) => {
    if (!signal) return <Minus className="w-4 h-4 text-muted-foreground" />;
    const s = signal.toLowerCase();
    if (s.includes('bull')) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (s.includes('bear')) return <TrendingDown className="w-4 h-4 text-red-500" />;
    if (s.includes('over')) return <TrendingUp className="w-4 h-4 text-amber-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const timeframeData = [
    { label: 'Short Term', data: pulse.shortTerm, key: 'shortTerm' },
    { label: 'Medium Term', data: pulse.mediumTerm, key: 'mediumTerm' },
    { label: 'Long Term', data: pulse.longTerm, key: 'longTerm' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Gold Market Pulse</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ₹{pulse.price}/g · {pulse.dataDate || pulse.dataDate}
        </p>
      </div>

      {/* Current Price Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gold Rate (24K)</p>
          <p className="text-xl font-bold mt-1">{formatINR(pulse.price)}/g</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">XAU/USD</p>
          <p className="text-xl font-bold mt-1">{formatUSD(pulse.priceUsd)}/oz</p>
        </div>
        {pulse.rsi7 != null && (
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">RSI (7)</p>
            <p className={`text-xl font-bold mt-1 ${pulse.rsi7 > 70 ? 'text-red-500' : pulse.rsi7 < 30 ? 'text-green-500' : ''}`}>
              {pulse.rsi7?.toFixed(1)}
            </p>
          </div>
        )}
        {pulse.volatilityLevel && (
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Volatility</p>
            <p className={`text-xl font-bold mt-1 ${pulse.volatilityLevel === 'High' ? 'text-red-500' : pulse.volatilityLevel === 'Medium' ? 'text-amber-500' : 'text-green-500'}`}>
              {pulse.volatilityLevel}
            </p>
          </div>
        )}
      </div>

      {/* Signal Cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        {timeframeData.map(tf => (
          <div key={tf.key} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tf.label}</p>
              <SignalIcon signal={tf.data?.signal} />
            </div>
            <p className={`text-lg font-bold ${
              tf.data?.signal?.toLowerCase().includes('bull') ? 'text-green-600' :
              tf.data?.signal?.toLowerCase().includes('bear') ? 'text-red-600' :
              tf.data?.signal?.toLowerCase().includes('over') ? 'text-amber-600' :
              ''
            }`}>
              {tf.data?.signal || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Score: {tf.data?.score || 0}</p>
            {tf.data?.drivers?.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {tf.data.drivers.map((d, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground">• {d}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Price Chart */}
      {pulse.chart?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Price History (USD/g)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={pulse.chart}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#92400e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#92400e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="price" stroke="#92400e" fill="url(#colorPrice)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Technical Indicators */}
      <div className="grid sm:grid-cols-2 gap-3">
        {pulse.rsi14 != null && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">RSI (14)</h3>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${
                pulse.rsi14 > 70 ? 'bg-red-500' : pulse.rsi14 > 55 ? 'bg-amber-500' : pulse.rsi14 < 30 ? 'bg-green-500' : 'bg-blue-500'
              }`} style={{ width: `${pulse.rsi14}%` }} />
            </div>
            <p className="text-right text-xs mt-1 text-muted-foreground">{pulse.rsi14?.toFixed(1)}</p>
          </div>
        )}
        {pulse.macd && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">MACD</h3>
            <p className="text-sm">Value: {pulse.macd.value?.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              Signal: {pulse.macd.signalLine?.toFixed(2)} · Histogram: {pulse.macd.histogram?.toFixed(2)}
            </p>
          </div>
        )}
        {pulse.bollinger20 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bollinger Bands (20)</h3>
            <p className="text-xs">Upper: {pulse.bollinger20.upper?.toFixed(1)}</p>
            <p className="text-xs">Middle: {pulse.bollinger20.middle?.toFixed(1)}</p>
            <p className="text-xs">Lower: {pulse.bollinger20.lower?.toFixed(1)}</p>
            {pulse.bollinger20.pctB != null && (
              <p className="text-xs text-muted-foreground mt-1">%B: {pulse.bollinger20.pctB.toFixed(2)}</p>
            )}
          </div>
        )}
        {pulse.roc20 != null && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Returns</h3>
            <p className={`text-sm ${pulse.roc5 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              5-day: {pulse.roc5?.toFixed(2)}%
            </p>
            <p className={`text-sm ${pulse.roc20 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              20-day: {pulse.roc20?.toFixed(2)}%
            </p>
            {pulse.roc60 != null && (
              <p className={`text-sm ${pulse.roc60 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                60-day: {pulse.roc60?.toFixed(2)}%
              </p>
            )}
          </div>
        )}
      </div>

      {/* Fib Levels & Pivot Points */}
      <div className="grid sm:grid-cols-2 gap-3">
        {pulse.fibLevels && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fibonacci Levels</h3>
            <div className="space-y-1 text-xs">
              <p><span className="text-muted-foreground">High:</span> {pulse.fibLevels.high?.toFixed(1)}</p>
              <p><span className="text-muted-foreground">0.786:</span> {pulse.fibLevels.level786?.toFixed(1)}</p>
              <p><span className="text-muted-foreground">0.618:</span> {pulse.fibLevels.level618?.toFixed(1)}</p>
              <p><span className="text-muted-foreground">0.500:</span> {pulse.fibLevels.level500?.toFixed(1)}</p>
              <p><span className="text-muted-foreground">0.382:</span> {pulse.fibLevels.level382?.toFixed(1)}</p>
              <p><span className="text-muted-foreground">0.236:</span> {pulse.fibLevels.level236?.toFixed(1)}</p>
              <p><span className="text-muted-foreground">Low:</span> {pulse.fibLevels.low?.toFixed(1)}</p>
            </div>
          </div>
        )}
        {pulse.pivotPoints && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pivot Points</h3>
            <div className="space-y-1 text-xs">
              <p className="text-green-600"><span className="text-muted-foreground">R3:</span> {pulse.pivotPoints.r3?.toFixed(1)}</p>
              <p className="text-green-500"><span className="text-muted-foreground">R2:</span> {pulse.pivotPoints.r2?.toFixed(1)}</p>
              <p className="text-green-400"><span className="text-muted-foreground">R1:</span> {pulse.pivotPoints.r1?.toFixed(1)}</p>
              <p className="font-bold"><span className="text-muted-foreground">Pivot:</span> {pulse.pivotPoints.pivot?.toFixed(1)}</p>
              <p className="text-red-400"><span className="text-muted-foreground">S1:</span> {pulse.pivotPoints.s1?.toFixed(1)}</p>
              <p className="text-red-500"><span className="text-muted-foreground">S2:</span> {pulse.pivotPoints.s2?.toFixed(1)}</p>
              <p className="text-red-600"><span className="text-muted-foreground">S3:</span> {pulse.pivotPoints.s3?.toFixed(1)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
