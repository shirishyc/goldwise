import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const brands = db.prepare('SELECT name FROM brands ORDER BY name ASC').all();
  res.json({ brands: brands.map(b => b.name) });
});

export default router;
