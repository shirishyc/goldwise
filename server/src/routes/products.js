import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/products — list products with filters
router.get('/', (req, res) => {
  const { brand, category, karat, search, page = 1, limit = 20, sort = 'premium_asc' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['1=1'];
  let params = [];

  if (brand) { where.push('LOWER(brand) LIKE ?'); params.push(`%${brand.toLowerCase()}%`); }
  if (category) { where.push('category = ?'); params.push(category); }
  if (karat) { where.push('karat = ?'); params.push(karat); }
  if (search) { where.push('LOWER(name) LIKE ?'); params.push(`%${search.toLowerCase()}%`); }

  // Count
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM products WHERE ${where.join(' AND ')}`).get(...params);

  // Sort
  let orderBy = 'premium_percent ASC';
  if (sort === 'premium_desc') orderBy = 'premium_percent DESC';
  else if (sort === 'price_asc') orderBy = 'price ASC';
  else if (sort === 'price_desc') orderBy = 'price DESC';
  else if (sort === 'name_asc') orderBy = 'name ASC';

  const rows = db.prepare(`
    SELECT * FROM products
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  // Get current gold rate for reference
  const goldRate = db.prepare(`
    SELECT rate_per_gram, karat FROM gold_rates
    WHERE source = 'goodreturns' AND scraped_at >= datetime('now', '-1 day')
    ORDER BY scraped_at DESC LIMIT 4
  `).all();

  const rateMap = {};
  for (const r of goldRate) {
    if (r.karat) rateMap[`per_gram_${r.karat}`] = r.rate_per_gram;
  }

  res.json({
    products: rows,
    total: countRow.total,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil(countRow.total / parseInt(limit)),
    gold_rate: {
      ...rateMap,
      currency: 'INR',
      updated_at: new Date().toISOString(),
      source: 'goodreturns',
    }
  });
});

// GET /api/products/summary — dashboard summary
router.get('/summary', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM products').get();
  const bestDeals = db.prepare(`
    SELECT * FROM products
    WHERE premium_percent IS NOT NULL
    ORDER BY premium_percent ASC
    LIMIT 5
  `).all();

  const byCategory = db.prepare(`
    SELECT
      category,
      COUNT(*) as count,
      MIN(premium_percent) as min_premium,
      ROUND(AVG(premium_percent), 2) as avg_premium,
      MIN(price) as min_price,
      MAX(price) as max_price,
      SUM(CASE WHEN premium_percent < 3 THEN 1 ELSE 0 END) as count_exceptional,
      SUM(CASE WHEN premium_percent >= 3 AND premium_percent < 8 THEN 1 ELSE 0 END) as count_value_picks,
      SUM(CASE WHEN premium_percent >= 8 AND premium_percent < 12 THEN 1 ELSE 0 END) as count_good_picks,
      SUM(CASE WHEN premium_percent >= 12 THEN 1 ELSE 0 END) as count_neutral_picks
    FROM products
    WHERE premium_percent IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
  `).all();

  const minPremium = db.prepare('SELECT MIN(premium_percent) as v FROM products WHERE premium_percent IS NOT NULL').get();
  const maxPremium = db.prepare('SELECT MAX(premium_percent) as v FROM products WHERE premium_percent IS NOT NULL').get();
  const avgPremium = db.prepare('SELECT ROUND(AVG(premium_percent), 2) as v FROM products WHERE premium_percent IS NOT NULL').get();

  const activeCoupons = db.prepare(`
    SELECT DISTINCT coupon_code FROM products
    WHERE coupon_code IS NOT NULL AND coupon_code != ''
  `).all();

  res.json({
    total_products: total.c,
    best_deals: bestDeals,
    by_category: byCategory,
    avg_premium_overall: avgPremium?.v || 0,
    min_premium: minPremium?.v || 0,
    max_premium: maxPremium?.v || 0,
    count_lte_5pct_premium: db.prepare('SELECT COUNT(*) as c FROM products WHERE premium_percent <= 5').get().c,
    count_lte_3pct_premium: db.prepare('SELECT COUNT(*) as c FROM products WHERE premium_percent <= 3').get().c,
    active_coupon_codes: activeCoupons.map(c => c.coupon_code).filter(Boolean),
  });
});

export default router;
