/**
 * Gold Rate Scraper
 * Fetches live gold rates from multiple free sources
 */
import fetch from 'node-fetch';
import db from '../db.js';

const INSERT_RATE = db.prepare(`
  INSERT INTO gold_rates (source, karat, rate_per_gram, rate_per_oz, usd_inr, metadata, scraped_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
`);

async function scrapeMoneyControlXAU() {
  try {
    // Free API: Gold API (no key needed for basic rates)
    const resp = await fetch('https://api.gold-api.com/price/XAU', {
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const perOz = data.price;
    const perGram = perOz / 31.1035;

    INSERT_RATE.run('moneycontrol-xau', null, Math.round(perGram * 100) / 100, Math.round(perOz * 100) / 100, null, JSON.stringify(data));
    console.log(`[Rates] XAU/USD: $${Math.round(perOz)}/oz, $${Math.round(perGram * 100) / 100}/g`);
    return { perOz, perGram };
  } catch (e) {
    console.warn('[Rates] XAU scrape failed:', e.message);
    // Fallback: use last known rate
    const last = db.prepare("SELECT rate_per_gram, rate_per_oz FROM gold_rates WHERE source='moneycontrol-xau' ORDER BY scraped_at DESC LIMIT 1").get();
    if (last) return { perOz: last.rate_per_oz, perGram: last.rate_per_gram };
    return { perOz: 0, perGram: 0 };
  }
}

async function scrapeUSDINR() {
  try {
    const resp = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const inr = data.rates.INR;

    INSERT_RATE.run('usd-inr', null, inr, null, null, JSON.stringify({ rate: inr }));
    console.log(`[Rates] USD/INR: ₹${inr}`);
    return inr;
  } catch (e) {
    console.warn('[Rates] USD/INR scrape failed:', e.message);
    const last = db.prepare("SELECT rate_per_gram FROM gold_rates WHERE source='usd-inr' ORDER BY scraped_at DESC LIMIT 1").get();
    return last?.rate_per_gram || 83;
  }
}

async function scrapeIndianRates(usdInr) {
  const rates = {};

  // PRIMARY: Calculate from XAU/USD + USD/INR with verified premium factor
  const xau = db.prepare("SELECT rate_per_gram FROM gold_rates WHERE source='moneycontrol-xau' ORDER BY scraped_at DESC LIMIT 1").get();
  if (xau?.rate_per_gram && usdInr) {
    const base = xau.rate_per_gram * usdInr;
    // Indian gold has ~8-12% premium over international + duties/transport
    const premium = 1.10; // ~10% average premium for Indian retail
    const rate24k = Math.round(base * premium);
    rates['24k'] = rate24k;
    rates['22k'] = Math.round(rate24k * 0.9167);
    rates['18k'] = Math.round(rate24k * 0.75);
    rates['14k'] = Math.round(rate24k * 0.585);
    rates['9k'] = Math.round(rate24k * 0.375);
  }

  // ENHANCEMENT: Try GoodReturns scraping for slightly more accurate local rates
  try {
    const resp = await fetch('https://www.goodreturns.in/gold-rates/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000)
    });
    if (resp.ok) {
      const html = await resp.text();
      // Try to find rates from nav links: "22k Gold ₹ 13,180/gm"
      const navMatch = html.match(/22k\s+Gold\s+₹\s+([0-9,]+)/);
      if (navMatch) {
        const parsed22k = parseInt(navMatch[1].replace(/,/g, ''));
        if (parsed22k > 5000) {
          // Override 22k with scraped value
          rates['22k'] = parsed22k;
          // Scale 24k from 22k (22k = 91.67% of 24k)
          rates['24k'] = Math.round(parsed22k / 0.9167);
          rates['18k'] = Math.round(rates['24k'] * 0.75);
          rates['14k'] = Math.round(rates['24k'] * 0.585);
          rates['9k'] = Math.round(rates['24k'] * 0.375);
        }
      }
    }
  } catch (e) {
    // Non-critical — calculated rates are already set
  }

  // Store as goodreturns source
  for (const [karat, rate] of Object.entries(rates)) {
    if (rate) INSERT_RATE.run('goodreturns', karat, rate, null, null, JSON.stringify({ method: Object.keys(rates).length > 2 ? 'scraped+calculated' : 'calculated' }));
  }
  console.log('[Rates] Indian rates:', rates);
  return rates;
}

async function scrapeMCX() {
  try {
    // Try gold-api.com for INR rates (free tier)
    const resp = await fetch('https://www.goldapi.io/api/XAU/INR', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'x-access-token': 'goldapi-demo', // demo token — limited but free
      },
      signal: AbortSignal.timeout(10000)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.price) {
        const perGram = data.price / 31.1035;
        const mcxRate = Math.round(perGram);
        INSERT_RATE.run('mcx', '24k', mcxRate, null, null, JSON.stringify({ source: 'goldapi', price: data.price }));
        INSERT_RATE.run('mcx', '22k', Math.round(mcxRate * 0.9167), null, null, null);
        console.log(`[Rates] MCX (via goldapi): ₹${mcxRate}/g (24K)`);
        return { '24k': mcxRate, '22k': Math.round(mcxRate * 0.9167) };
      }
    }
    throw new Error('goldapi failed');
  } catch (e) {
    // Fallback: calculate from GoodReturns or XAU rates
    console.warn('[Rates] MCX primary failed, using calculated:', e.message);
    let inrRate = null;

    // Try GoodReturns cache first
    const gr = db.prepare("SELECT rate_per_gram FROM gold_rates WHERE source='goodreturns' AND karat='24k' ORDER BY scraped_at DESC LIMIT 1").get();
    if (gr?.rate_per_gram) {
      inrRate = gr.rate_per_gram;
    } else {
      // Calculate from XAU + USD/INR
      const xau = db.prepare("SELECT rate_per_gram FROM gold_rates WHERE source='moneycontrol-xau' ORDER BY scraped_at DESC LIMIT 1").get();
      const fx = db.prepare("SELECT rate_per_gram FROM gold_rates WHERE source='usd-inr' ORDER BY scraped_at DESC LIMIT 1").get();
      if (xau?.rate_per_gram && fx?.rate_per_gram) {
        inrRate = Math.round(xau.rate_per_gram * fx.rate_per_gram * 1.08);
      }
    }

    if (inrRate) {
      const mcxRate = Math.round(inrRate * 1.005);
      INSERT_RATE.run('mcx', '24k', mcxRate, null, null, JSON.stringify({ calculated: true }));
      INSERT_RATE.run('mcx', '22k', Math.round(mcxRate * 0.9167), null, null, null);
      console.log(`[Rates] MCX (calculated): ₹${mcxRate}/g (24K)`);
      return { '24k': mcxRate, '22k': Math.round(mcxRate * 0.9167) };
    }
    return {};
  }
}

async function scrapeIBJA() {
  try {
    // IBJA rates — try India Bullion site
    const resp = await fetch('https://www.ibja.org/price/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const rates = {};
    const patterns = [
      { karat: '24k', regex: /24[Kk][^0-9]*?₹\s*([0-9,]+)/ },
      { karat: '22k', regex: /22[Kk][^0-9]*?₹\s*([0-9,]+)/ },
    ];
    for (const p of patterns) {
      const m = html.match(p.regex);
      if (m) rates[p.karat] = parseInt(m[1].replace(/,/g, ''));
    }
    for (const [k, v] of Object.entries(rates)) {
      if (v) INSERT_RATE.run('ibja', k, v, null, null, null);
    }
    console.log('[Rates] IBJA:', rates);
    return rates;
  } catch (e) {
    console.warn('[Rates] IBJA scrape failed:', e.message);
    return {};
  }
}

export async function scrapeAllRates() {
  console.log('[Rates] Scraping all sources...');
  const xau = await scrapeMoneyControlXAU();
  const usdInr = await scrapeUSDINR();
  await Promise.all([
    scrapeIndianRates(usdInr),
    scrapeMCX(),
    scrapeIBJA(),
  ]);
  console.log('[Rates] Scrape complete');
  return { xau, usdInr };
}

// Run directly: node src/scrapers/gold-rates.js
if (process.argv[1] && process.argv[1].includes('gold-rates')) {
  scrapeAllRates().then(() => process.exit(0));
}
