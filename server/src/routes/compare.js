import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/compare — compare products by brand + category
router.get('/', (req, res) => {
  const { brand, category } = req.query;
  let where = ['1=1'];
  let params = [];

  if (brand) { where.push('LOWER(brand) LIKE ?'); params.push(`%${brand.toLowerCase()}%`); }
  if (category) { where.push('category = ?'); params.push(category); }

  const rows = db.prepare(`
    SELECT id, name, category, karat, price, premium_percent,
           effective_price_per_gram, gold_weight, jeweller_source, brand,
           product_url, image_url
    FROM products
    WHERE ${where.join(' AND ')}
    ORDER BY premium_percent ASC
    LIMIT 50
  `).all(...params);

  res.json({ rows });
});

// GET /api/compare/categories — comparison matrix
router.get('/categories', (req, res) => {
  const { limit = 200 } = req.query;

  const rows = db.prepare(`
    SELECT jeweller_source, category, karat,
           MIN(premium_percent) as premium,
           COUNT(*) as product_count,
           ROUND(AVG(premium_percent), 2) as avg_premium
    FROM products
    WHERE premium_percent IS NOT NULL
    GROUP BY jeweller_source, category, karat
    ORDER BY jeweller_source, premium ASC
    LIMIT ?
  `).all(parseInt(limit));

  res.json({ rows });
});

export default router;
