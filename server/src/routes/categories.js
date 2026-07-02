import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const categories = db.prepare('SELECT name FROM categories ORDER BY name ASC').all();
  res.json({ categories: categories.map(c => c.name) });
});

export default router;
