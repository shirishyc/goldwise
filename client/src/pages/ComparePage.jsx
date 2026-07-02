import { useState, useEffect } from 'react';
import { BarChart3, Filter } from 'lucide-react';
import { getCompareCategories, getBrands, getCategories } from '../lib/api';
import { formatINR, premiumColor } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const KARAT_COLORS = {
  '24': '#92400e',
  '22': '#b45309',
  '18': '#d97706',
  '14': '#f59e0b',
};

export default function ComparePage() {
  const [rows, setRows] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    getCompareCategories().then(d => setRows(d.rows || [])).catch(() => {});
    getBrands().then(d => setBrands(d.brands || [])).catch(() => {});
    getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  // Filter rows
  const filtered = rows.filter(r => {
    if (selectedBrand && r.jeweller_source !== selectedBrand) return false;
    if (selectedCategory && r.category !== selectedCategory) return false;
    return true;
  });

  // Group by jeweller for the chart
  const byJeweller = {};
  for (const r of filtered) {
    if (!byJeweller[r.jeweller_source]) byJeweller[r.jeweller_source] = [];
    byJeweller[r.jeweller_source].push(r);
  }

  // Chart data: min premium per jeweller per karat
  const chartData = Object.entries(byJeweller).map(([name, items]) => {
    const entry = { name: name.length > 12 ? name.slice(0, 12) + '…' : name, fullName: name };
    for (const item of items) {
      if (item.karat) entry[`K${item.karat}`] = item.premium;
    }
    return entry;
  }).slice(0, 20);

  // Unique karats present
  const karats = [...new Set(filtered.map(r => r.karat).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Compare Jewellers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          See who's pricing gold closest to spot today — premium % by karat and category
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={selectedBrand}
            onChange={e => setSelectedBrand(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-lg border border-border text-sm bg-card appearance-none cursor-pointer"
          >
            <option value="">All Jewellers</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border text-sm bg-card appearance-none cursor-pointer"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {/* Chart */}
      {chartData.length > 0 && karats.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Premium % by Jeweller</h2>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }}>
              <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Premium']}
                labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
              />
              {karats.map(k => (
                <Bar key={k} dataKey={`K${k}`} fill={KARAT_COLORS[k] || '#92400e'} radius={[0, 4, 4, 0]} stackId="a" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Jeweller</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Karat</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Premium %</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Avg Premium</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Products</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2 font-medium">{row.jeweller_source}</td>
                  <td className="px-4 py-2 text-muted-foreground capitalize">{row.category?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2">{row.karat}K</td>
                  <td className={`px-4 py-2 text-right font-semibold ${premiumColor(row.premium)}`}>
                    {row.premium?.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{row.avg_premium?.toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{row.product_count}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No comparison data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
