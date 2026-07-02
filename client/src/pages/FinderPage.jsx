import { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { getProducts, getBrands, getCategories, getLiveRates } from '../lib/api';
import { formatINR, premiumColor, premiumLabel } from '../lib/utils';

export default function FinderPage() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedKarat, setSelectedKarat] = useState('');
  const [sort, setSort] = useState('premium_asc');
  const [showFilters, setShowFilters] = useState(false);

  const limit = 24;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, sort };
      if (selectedBrand) params.brand = selectedBrand;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedKarat) params.karat = selectedKarat;
      if (search) params.search = search;
      const data = await getProducts(params);
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Fetch products error:', e);
    }
    setLoading(false);
  }, [page, selectedBrand, selectedCategory, selectedKarat, sort, search]);

  useEffect(() => {
    getBrands().then(d => setBrands(d.brands || [])).catch(() => {});
    getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
    getLiveRates().then(setRates).catch(() => {});
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const totalPages = Math.ceil(total / limit);

  const karatOptions = ['14', '18', '22', '24'];

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg border ${showFilters ? 'bg-primary text-white border-primary' : 'border-border'} transition-colors`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Brand</label>
              <select
                value={selectedBrand}
                onChange={e => { setSelectedBrand(e.target.value); setPage(1); }}
                className="w-full mt-1 px-2 py-1.5 rounded border border-border text-sm bg-background"
              >
                <option value="">All Brands</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Category</label>
              <select
                value={selectedCategory}
                onChange={e => { setSelectedCategory(e.target.value); setPage(1); }}
                className="w-full mt-1 px-2 py-1.5 rounded border border-border text-sm bg-background"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Karat</label>
              <select
                value={selectedKarat}
                onChange={e => { setSelectedKarat(e.target.value); setPage(1); }}
                className="w-full mt-1 px-2 py-1.5 rounded border border-border text-sm bg-background"
              >
                <option value="">All Karats</option>
                {karatOptions.map(k => <option key={k} value={k}>{k}K</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sort By</label>
              <select
                value={sort}
                onChange={e => { setSort(e.target.value); setPage(1); }}
                className="w-full mt-1 px-2 py-1.5 rounded border border-border text-sm bg-background"
              >
                <option value="premium_asc">Premium (Low)</option>
                <option value="premium_desc">Premium (High)</option>
                <option value="price_asc">Price (Low)</option>
                <option value="price_desc">Price (High)</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>
          </div>
          {(selectedBrand || selectedCategory || selectedKarat) && (
            <button
              onClick={() => { setSelectedBrand(''); setSelectedCategory(''); setSelectedKarat(''); setPage(1); }}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results Info */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading...' : `${total.toLocaleString()} products found`}
        </p>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-3 animate-pulse">
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-muted/30" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted/30 rounded w-3/4" />
                  <div className="h-3 bg-muted/30 rounded w-1/2" />
                  <div className="h-4 bg-muted/30 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No products found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {products.map(product => (
              <a key={product.id} href={product.product_url || '#'} target="_blank" rel="noopener noreferrer"
                className="bg-card border border-border rounded-lg p-3 hover:shadow-sm hover:border-primary/20 transition-all group">
                <div className="flex gap-3">
                  <img
                    src={product.image_url || 'https://placehold.co/80x80/amber/white?text=Gold'}
                    alt={product.name}
                    className="w-16 h-16 rounded-lg object-cover bg-amber-50 shrink-0"
                    onError={(e) => { e.target.src = 'https://placehold.co/80x80/amber/white?text=Gold'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{product.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {product.brand} · {product.karat}K · {product.category?.replace(/_/g, ' ')}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-sm font-bold">{formatINR(product.price)}</span>
                      <span className={`text-xs font-semibold ${premiumColor(product.premium_percent)}`}>
                        {product.premium_percent != null ? `${product.premium_percent.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${premiumColor(product.premium_percent)}`}>
                      {premiumLabel(product.premium_percent)}
                    </p>
                    {product.price_coupon && (
                      <p className="text-[10px] text-green-600 mt-0.5">
                        Coupon: {product.coupon_code} → {formatINR(product.price_coupon)}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded border border-border text-sm disabled:opacity-40 hover:bg-muted/30 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded border border-border text-sm disabled:opacity-40 hover:bg-muted/30 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
