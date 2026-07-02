import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/pulse — market pulse / technical analysis
router.get('/', (req, res) => {
  const pulse = db.prepare(`
    SELECT * FROM market_pulse
    ORDER BY generated_at DESC
    LIMIT 1
  `).get();

  if (!pulse) {
    return res.json({
      price: 0,
      priceUsd: 0,
      shortTerm: { score: 0, signal: 'N/A', drivers: [] },
      mediumTerm: { score: 0, signal: 'N/A', drivers: [] },
      longTerm: { score: 0, signal: 'N/A', drivers: [] },
      chart: [],
      dataDate: new Date().toISOString().split('T')[0],
    });
  }

  res.json({
    price: pulse.price,
    priceUsd: pulse.price_usd,
    shortTerm: pulse.short_term ? JSON.parse(pulse.short_term) : { score: 0, signal: 'N/A', drivers: [] },
    mediumTerm: pulse.medium_term ? JSON.parse(pulse.medium_term) : { score: 0, signal: 'N/A', drivers: [] },
    longTerm: pulse.long_term ? JSON.parse(pulse.long_term) : { score: 0, signal: 'N/A', drivers: [] },
    chart: pulse.chart_data ? JSON.parse(pulse.chart_data) : [],
    ...(pulse.indicators ? JSON.parse(pulse.indicators) : {}),
    dataDate: pulse.generated_at ? pulse.generated_at.split('T')[0] : new Date().toISOString().split('T')[0],
  });
});

// GET /api/pulse/ai-summary — simple market summary text
router.get('/ai-summary', (req, res) => {
  const pulse = db.prepare(`
    SELECT * FROM market_pulse
    ORDER BY generated_at DESC
    LIMIT 1
  `).get();

  if (!pulse) {
    return res.json({ summary: 'No market data available yet. Data is being collected.' });
  }

  const st = pulse.short_term ? JSON.parse(pulse.short_term) : {};
  const mt = pulse.medium_term ? JSON.parse(pulse.medium_term) : {};
  const lt = pulse.long_term ? JSON.parse(pulse.long_term) : {};

  const summaries = [];
  if (st.signal) summaries.push(`Short-term: ${st.signal} (${st.score})`);
  if (mt.signal) summaries.push(`Medium-term: ${mt.signal} (${mt.score})`);
  if (lt.signal) summaries.push(`Long-term: ${lt.signal} (${lt.score})`);

  res.json({
    summary: summaries.join(' | ') || 'Analyzing market data...',
    price: `₹${pulse.price}/g` || 'N/A',
    date: pulse.generated_at?.split(' ')[0] || 'N/A',
  });
});

// POST /api/pulse/force-regenerate — force recalculation
router.post('/force-regenerate', async (req, res) => {
  try {
    const { calculatePulse } = await import('../scrapers/pulse-calculator.js');
    await calculatePulse();
    res.json({ success: true, message: 'Market pulse regenerated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
