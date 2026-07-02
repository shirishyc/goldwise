import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/news — gold market news
router.get('/', (req, res) => {
  const items = db.prepare(`
    SELECT title, link, source, published_at
    FROM news_cache
    ORDER BY published_at DESC
    LIMIT 30
  `).all();

  res.json({ items });
});

export default router;
