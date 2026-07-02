import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, X, Bell, Download, Home, Search, BarChart3, Calculator, Info, TrendingUp } from 'lucide-react';
import GoldTicker from './GoldTicker';
import { getLiveRates } from '../lib/api';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/finder', label: 'Finder', icon: Search },
  { path: '/compare', label: 'Compare', icon: BarChart3 },
  { path: '/pulse', label: 'Market', icon: TrendingUp },
  { path: '/calculator', label: 'Calculator', icon: Calculator },
  { path: '/about', label: 'About', icon: Info },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const [rates, setRates] = useState(null);

  useEffect(() => {
    getLiveRates().then(setRates).catch(() => {});
    const interval = setInterval(() => getLiveRates().then(setRates).catch(() => {}), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40 shadow-sm">
        <div className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center gap-3 py-2">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Open navigation"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/" className="flex-1 hover:opacity-80 transition-opacity">
            <div className="flex flex-col leading-tight">
              <span className="font-serif text-xl font-bold tracking-wide text-foreground">GoldWise</span>
              <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-sans hidden sm:block">
                Open Source Gold Intelligence
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/pulse"
              className="flex items-center gap-1 text-[11px] font-semibold text-primary/70 hover:text-primary transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Market</span>
            </Link>
            <Link
              to="/"
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              Open
            </Link>
          </div>
        </div>

        {/* Dropdown Nav */}
        {menuOpen && (
          <div className="border-t border-border bg-card">
            <nav className="px-4 py-2 max-w-7xl mx-auto">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Gold Ticker */}
      <GoldTicker rates={rates} />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <div className="text-center sm:text-left">
              <span className="font-serif font-bold text-sm text-foreground">GoldWise</span>
              <p className="mt-1">Open Source Gold Price Intelligence · Not a jewellery seller</p>
              <p>Data sourced from public APIs and web scraping · Verify with jeweller before purchase</p>
            </div>
            <div className="flex gap-4">
              {NAV_ITEMS.map(item => (
                <Link key={item.path} to={item.path} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-center text-[10px] text-muted-foreground">
            GoldWise v1.0.0 — Open Source (MIT)
          </div>
        </div>
      </footer>
    </div>
  );
}
