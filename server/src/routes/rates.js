import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const rates = db.prepare(`
    SELECT source, karat, rate_per_gram, rate_per_oz, usd_inr, metadata, scraped_at
    FROM gold_rates
    WHERE scraped_at >= datetime('now', '-1 hour')
    ORDER BY scraped_at DESC
  `).all();

  // Get the latest scraped_at for each source
  const latestRates = {};
  for (const r of rates) {
    if (!latestRates[r.source]) latestRates[r.source] = [];
    latestRates[r.source].push(r);
  }

  // Build response matching Karatwise format
  const xauRate = latestRates['moneycontrol-xau']?.[0];
  const mcxRates = latestRates['mcx'] || [];
  const goodReturns = latestRates['goodreturns'] || [];
  const ibja = latestRates['ibja'] || [];
  const usdInr = latestRates['usd-inr']?.[0];

  const response = {
    xauUsd: xauRate ? {
      perGram: xauRate.rate_per_gram,
      perOz: xauRate.rate_per_oz,
    } : { perGram: 0, perOz: 0 },
    usdInr: usdInr?.rate_per_gram || 0,
    inr: {},
    mcx: {},
    ibja: {},
    goodreturns: {},
    updatedAt: xauRate?.scraped_at || new Date().toISOString(),
    source: Object.keys(latestRates).join('+') || 'cache',
  };

  for (const r of goodReturns) {
    if (r.karat) response.inr[`per_gram_${r.karat}`] = r.rate_per_gram;
  }

  for (const r of mcxRates) {
    if (r.karat) response.mcx[`per_gram_${r.karat}`] = r.rate_per_gram;
    if (r.rate_per_oz) response.mcx.usdPerOz = r.rate_per_oz;
    if (r.scraped_at) response.mcx.scraped_at = r.scraped_at;
  }

  for (const r of ibja) {
    if (r.karat) response.ibja[`per_gram_${r.karat}`] = r.rate_per_gram;
    if (r.scraped_at) response.ibja.scraped_at = r.scraped_at;
  }

  // Fallback defaults if no data yet
  if (Object.keys(response.inr).length === 0) {
    response.inr = { per_gram_24k: 0, per_gram_22k: 0, per_gram_18k: 0, per_gram_14k: 0, per_gram_9k: 0 };
  }

  res.json(response);
});

export default router;
