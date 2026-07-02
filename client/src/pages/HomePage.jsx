import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingBag, Coins, BarChart3, Calculator, ArrowRight, Sparkles } from 'lucide-react';
import { getLiveRates, getProductsSummary, getPulseSummary } from '../lib/api';
import { formatINR, premiumColor } from '../lib/utils';

export default function HomePage() {
  const [summary, setSummary] = useState(null);
  const [pulseSummary, setPulseSummary] = useState(null);
  const [rates, setRates] = useState(null);

  useEffect(() => {
    getProductsSummary().then(setSummary).catch(() => {});
    getPulseSummary().then(setPulseSummary).catch(() => {});
    getLiveRates().then(setRates).catch(() => {});
  }, []);

  const trackedBrands = ['Tanishq', 'Bluestone', 'CaratLane', 'Candere', 'Melorra', 'Bhima Gold', 'Myntra', 'Ajio', 'Flipkart'];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-8">
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
          Don't Overpay for Gold Jewellery
        </h1>
        <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
          Live gold rates, real premiums, and today's best deals — all before you visit a jeweller.
          Open source, transparent, and free.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Link to="/finder" className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
            Browse Products →
          </Link>
          <Link to="/compare" className="px-5 py-2.5 rounded-lg border border-border text-sm font-semibold hover:bg-muted/30 transition-colors">
            Compare Jewellers
          </Link>
        </div>
      </section>

      {/* Tracked Brands */}
      <section>
        <p className="text-xs text-muted-foreground text-center uppercase tracking-wider mb-3">Currently Tracking</p>
        <div className="flex flex-wrap justify-center gap-2">
          {trackedBrands.map(brand => (
            <Link
              key={brand}
              to={`/finder?brand=${encodeURIComponent(brand)}`}
              className="px-3 py-1.5 rounded-full border border-border text-xs font-medium hover:bg-primary/5 hover:border-primary/30 transition-colors"
            >
              {brand}
            </Link>
          ))}
        </div>
      </section>

      {/* Stats Row */}
      {summary && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{summary.total_products?.toLocaleString() || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Products Tracked</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.avg_premium_overall?.toFixed(1) || 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">Avg Premium</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{summary.count_lte_3pct_premium || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Best Deals (&lt;3%)</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{summary.active_coupon_codes?.length || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Active Coupons</p>
          </div>
        </section>
      )}

      {/* Feature Cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FeatureCard
          icon={<TrendingUp className="w-6 h-6" />}
          title="Gold Market Pulse"
          description={pulseSummary?.summary || 'Technical analysis of gold market trends'}
          link="/pulse"
          linkText="View Analysis"
        />
        <FeatureCard
          icon={<ShoppingBag className="w-6 h-6" />}
          title="Gold Value Picks"
          description="Curated products priced closest to raw gold rate — updated daily"
          link="/finder?sort=premium_asc"
          linkText="Browse Value Picks"
        />
        <FeatureCard
          icon={<Coins className="w-6 h-6" />}
          title="Coins & Bars"
          description="Gold coins and bars with lowest making charges"
          link="/finder?category=coins_and_bars"
          linkText="Browse Coins & Bars"
        />
        <FeatureCard
          icon={<BarChart3 className="w-6 h-6" />}
          title="Compare Jewellers"
          description="See who's pricing gold closest to spot — side by side"
          link="/compare"
          linkText="Compare Rates"
        />
        <FeatureCard
          icon={<Calculator className="w-6 h-6" />}
          title="Gold Cost Calculator"
          description="Calculate exact all-in price with making charges and GST"
          link="/calculator"
          linkText="Open Calculator"
        />
        <FeatureCard
          icon={<Sparkles className="w-6 h-6" />}
          title="Best Deals Today"
          description={summary?.best_deals?.length > 0
            ? `From ${summary.best_deals[0]?.brand || 'unknown'} — save on premium!`
            : 'Products with lowest premium %'}
          link="/finder?sort=premium_asc&limit=10"
          linkText="See Best Deals"
        />
      </section>

      {/* Best Deals Preview */}
      {summary?.best_deals?.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-bold mb-4">Today's Best Deals</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.best_deals.slice(0, 6).map(product => (
              <Link key={product.id} to={`/finder`} className="bg-card border border-border rounded-lg p-3 hover:shadow-sm transition-shadow">
                <div className="flex gap-3">
                  <img
                    src={product.image_url || 'https://placehold.co/80x80/amber/white?text=Gold'}
                    alt={product.name}
                    className="w-16 h-16 rounded-lg object-cover bg-amber-50"
                    onError={(e) => { e.target.src = 'https://placehold.co/80x80/amber/white?text=Gold'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.brand} · {product.karat}K</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold">{formatINR(product.price)}</span>
                      <span className={`text-xs font-semibold ${premiumColor(product.premium_percent)}`}>
                        {product.premium_percent?.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Info Section */}
      <section className="bg-card border border-border rounded-lg p-6 text-sm text-muted-foreground space-y-3">
        <p>
          <strong className="text-foreground">How Karatwise Works:</strong> Gold pricing in India is remarkably opaque.
          Every purchase carries two layers of additional cost beyond the metal: the <strong className="text-foreground">Premium %</strong>
          captures the making charge component — how much above raw spot you're paying before tax.
        </p>
        <div className="grid sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
            <span className="text-green-700 font-bold">&lt; 3%</span>
            <p className="text-green-600">Exceptional</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-center">
            <span className="text-emerald-700 font-bold">3-8%</span>
            <p className="text-emerald-600">Value Pick</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-center">
            <span className="text-amber-700 font-bold">8-12%</span>
            <p className="text-amber-600">Good Pick</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
            <span className="text-red-700 font-bold">&gt; 12%</span>
            <p className="text-red-600">Market Rate</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description, link, linkText }) {
  return (
    <Link to={link} className="bg-card border border-border rounded-lg p-5 hover:shadow-sm hover:border-primary/20 transition-all group">
      <div className="text-primary mb-3">{icon}</div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <span className="text-xs font-semibold text-primary group-hover:underline inline-flex items-center gap-1">
        {linkText} →
      </span>
    </Link>
  );
}
