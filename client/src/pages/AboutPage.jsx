import { Github } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-serif text-2xl font-bold">About GoldWise</h1>

      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">GoldWise</strong> is an open-source gold jewellery price intelligence
          platform. It helps consumers find gold jewellery priced closest to the raw gold rate by tracking
          making charges (premium) across jewellers.
        </p>
        <p className="text-sm text-muted-foreground">
          Gold pricing in India is remarkably opaque. Every purchase carries additional costs beyond the metal:
          making charges and GST. GoldWise captures the making charge component — the <strong className="text-foreground">Premium %</strong> —
          showing how much above raw spot you're paying.
        </p>
      </section>

      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">How Premium % Works</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">premium%</strong> = ((price − spot_value) / spot_value) × 100</p>
          <p>Where <strong className="text-foreground">spot_value</strong> = gold_weight × today's gold rate for that karat</p>
          <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
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
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold">Features</h2>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>✓ Live gold rates from multiple sources (MCX, GoodReturns, IBJA, XAU/USD)</li>
          <li>✓ Product finder with brand, category, karat filters — sorted by premium</li>
          <li>✓ Jeweller comparison — side-by-side premium % across categories</li>
          <li>✓ Gold market pulse — technical analysis (RSI, MACD, SMA, Bollinger, Fibonacci)</li>
          <li>✓ Cost calculator — all-in price with making charges and GST</li>
          <li>✓ Credit card offers and coupon stacking</li>
          <li>✓ 40+ tracked brands including Tanishq, CaratLane, Bhima, Bluestone and more</li>
          <li>✓ 100% free and open source — no subscription, no ads</li>
        </ul>
      </section>

      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Data Sources</h2>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Gold Rates:</strong> MoneyControl (XAU/USD), MCX, GoodReturns, IBJA</p>
          <p><strong>Products:</strong> Public data scraped from jeweller websites</p>
          <p><strong>Exchange Rate:</strong> ExchangeRate-API</p>
        </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            ⚠️ This platform is for informational purposes only. Always verify prices directly with
            the jeweller before purchase. Not financial or investment advice.
          </p>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5 text-center">
        <a
          href="https://github.com/shirishyc/goldwise"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Github className="w-4 h-4" />
          View on GitHub
        </a>
        <p className="text-xs text-muted-foreground mt-2">MIT License · Open Source · Built with ❤️</p>
      </section>
    </div>
  );
}
