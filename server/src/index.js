import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cron from 'node-cron';

import ratesRouter from './routes/rates.js';
import productsRouter from './routes/products.js';
import compareRouter from './routes/compare.js';
import pulseRouter from './routes/pulse.js';
import newsRouter from './routes/news.js';
import brandsRouter from './routes/brands.js';
import categoriesRouter from './routes/categories.js';
import { scrapeAllRates } from './scrapers/gold-rates.js';
import { calculatePulse } from './scrapers/pulse-calculator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4567;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..', '..', 'client', 'dist')));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use('/api/live-rates', ratesRouter);
app.use('/api/products', productsRouter);
app.use('/api/compare', compareRouter);
app.use('/api/pulse', pulseRouter);
app.use('/api/news', newsRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/categories', categoriesRouter);

// Additional endpoints matching Karatwise API
app.use('/api/products/brands', brandsRouter);
app.use('/api/products/categories', categoriesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), version: '1.0.0' });
});

// Feedback endpoint
app.post('/api/feedback', (req, res) => {
  const { message, email } = req.body;
  console.log(`[Feedback] ${email || 'anonymous'}: ${message}`);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// SPA fallback — serve index.html for all non-API routes
// ---------------------------------------------------------------------------
app.get('*', (req, res) => {
  const indexPath = path.resolve(__dirname, '..', '..', 'client', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).json({
      message: 'GoldWise API is running. Frontend not built yet. Run: cd client && npm run build',
      endpoints: [
        '/api/live-rates', '/api/brands', '/api/categories',
        '/api/products', '/api/products/summary',
        '/api/compare', '/api/compare/categories',
        '/api/pulse', '/api/news', '/api/health'
      ]
    });
  }
});

// ---------------------------------------------------------------------------
// Scheduled Tasks
// ---------------------------------------------------------------------------
// Scrape gold rates every 10 minutes
cron.schedule('*/10 * * * *', () => {
  scrapeAllRates().catch(e => console.error('[Cron] Rates scrape failed:', e.message));
});

// Calculate market pulse every 6 hours
cron.schedule('0 */6 * * *', () => {
  calculatePulse().catch(e => console.error('[Cron] Pulse calc failed:', e.message));
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function startup() {
  console.log('[GoldWise] Starting up...');

  // Initial rate scrape
  try {
    await scrapeAllRates();
    console.log('[GoldWise] Initial rates scraped');
  } catch (e) {
    console.warn('[GoldWise] Initial rate scrape failed (will retry via cron):', e.message);
  }

  // Initial pulse calculation
  try {
    await calculatePulse();
    console.log('[GoldWise] Initial market pulse calculated');
  } catch (e) {
    console.warn('[GoldWise] Initial pulse calc failed (will retry via cron):', e.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GoldWise] Server running on http://0.0.0.0:${PORT}`);
  });
}

startup();
