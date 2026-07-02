/**
 * Market Pulse Calculator
 * Calculates technical indicators for gold market analysis
 */
import db from '../db.js';

export function calculatePulse() {
  // Get available rate history
  const rates = db.prepare(`
    SELECT rate_per_gram, scraped_at
    FROM gold_rates
    WHERE source = 'goodreturns' AND karat = '24k'
    ORDER BY scraped_at ASC
  `).all();

  // Also check moneycontrol-xau for USD-based historical
  const xauRates = db.prepare(`
    SELECT rate_per_gram, rate_per_oz, scraped_at
    FROM gold_rates
    WHERE source = 'moneycontrol-xau'
    ORDER BY scraped_at ASC
  `).all();

  // Get current 24K rate in INR
  const currentRate = db.prepare(`
    SELECT rate_per_gram FROM gold_rates
    WHERE source = 'goodreturns' AND karat = '24k'
    ORDER BY scraped_at DESC LIMIT 1
  `).get();

  const price = currentRate?.rate_per_gram || 0;

  // Get current XAU/USD
  const currentXau = db.prepare(`
    SELECT rate_per_oz FROM gold_rates
    WHERE source = 'moneycontrol-xau'
    ORDER BY scraped_at DESC LIMIT 1
  `).get();
  const priceUsd = currentXau?.rate_per_oz || 0;

  // Build daily price chart from scraped data
  const chartData = [];
  const dailyMap = {};

  for (const r of xauRates) {
    if (!r.rate_per_oz) continue;
    const day = r.scraped_at?.split(' ')[0];
    if (day && !dailyMap[day]) {
      dailyMap[day] = { date: day, price: r.rate_per_oz };
    }
  }

  // Also try to get from INR rates
  for (const r of rates) {
    if (!r.rate_per_gram) continue;
    const day = r.scraped_at?.split(' ')[0];
    if (day && !dailyMap[day]) {
      dailyMap[day] = { date: day, price: r.rate_per_gram };
    }
  }

  const prices = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // Calculate technical indicators if we have enough data
  const vals = prices.map(p => p.price);
  const n = vals.length;

  const result = {
    price,
    price_usd: priceUsd,
    short_term: { score: 50, signal: 'Neutral', drivers: [] },
    medium_term: { score: 50, signal: 'Neutral', drivers: [] },
    long_term: { score: 50, signal: 'Neutral', drivers: [] },
    chart_data: JSON.stringify(prices.slice(-120)), // last ~4 months
    indicators: {},
  };

  if (n >= 7) {
    // RSI(7)
    const rsi7 = calculateRSI(vals, 7);
    result.short_term.drivers.push(`RSI-7: ${rsi7.toFixed(1)}`);
    result.indicators.rsi7 = Math.round(rsi7 * 100) / 100;

    if (rsi7 > 70) { result.short_term.signal = 'Overbought'; result.short_term.score = 80; }
    else if (rsi7 < 30) { result.short_term.signal = 'Oversold'; result.short_term.score = 20; }
    else if (rsi7 > 55) { result.short_term.signal = 'Bullish'; result.short_term.score = 65; }
    else if (rsi7 < 45) { result.short_term.signal = 'Bearish'; result.short_term.score = 35; }
  }

  if (n >= 14) {
    const rsi14 = calculateRSI(vals, 14);
    result.medium_term.drivers.push(`RSI-14: ${rsi14.toFixed(1)}`);
    result.indicators.rsi14 = Math.round(rsi14 * 100) / 100;

    // SMA comparison
    const sma20 = calculateSMA(vals, 20);
    const sma50 = calculateSMA(vals, 50);
    if (sma20 && sma50) {
      result.medium_term.drivers.push(`SMA-20: ${sma20.toFixed(1)}`);
      result.medium_term.drivers.push(`SMA-50: ${sma50.toFixed(1)}`);
      if (sma20 > sma50) result.medium_term.drivers.push('SMA-20 above SMA-50');
      else result.medium_term.drivers.push('SMA-20 below SMA-50');
    }

    if (rsi14 > 70) { result.medium_term.signal = 'Overbought'; result.medium_term.score = 80; }
    else if (rsi14 < 30) { result.medium_term.signal = 'Oversold'; result.medium_term.score = 20; }
    else if (rsi14 > 55) { result.medium_term.signal = 'Bullish'; result.medium_term.score = 65; }
    else if (rsi14 < 45) { result.medium_term.signal = 'Bearish'; result.medium_term.score = 35; }
  }

  if (n >= 50) {
    const sma50 = calculateSMA(vals, 50);
    const sma100 = calculateSMA(vals, 100);
    if (sma50 && sma100) {
      result.long_term.drivers.push(`SMA-50: ${sma50.toFixed(1)}`);
      result.long_term.drivers.push(`SMA-100: ${sma100.toFixed(1)}`);
      if (sma50 > sma100) result.long_term.drivers.push('SMA-50 above SMA-100 (golden cross)');
      else result.long_term.drivers.push('SMA-50 below SMA-100 (death cross)');
    }

    // 60-day return
    if (n >= 60) {
      const ret60 = ((vals[n - 1] - vals[n - 60]) / vals[n - 60]) * 100;
      result.long_term.drivers.push(`60-day return: ${ret60.toFixed(2)}%`);
      result.indicators.roc60 = Math.round(ret60 * 100) / 100;
      if (ret60 > 10) result.long_term.signal = 'Bullish';
      else if (ret60 < -10) result.long_term.signal = 'Bearish';
    }

    if (result.long_term.signal === 'Neutral') {
      result.long_term.score = 45;
    }
  }

  // MACD calculation
  if (n >= 26) {
    const macd = calculateMACD(vals);
    if (macd) {
      result.indicators.macd = macd;
      const signal = macd.histogram >= 0 ? 'positive' : 'negative';
      result.short_term.drivers.push(`MACD: ${signal} histogram`);
    }
  }

  // Bollinger Bands
  if (n >= 20) {
    const bb = calculateBollinger(vals, 20);
    if (bb) {
      result.indicators.bollinger20 = bb;
      const lastVal = vals[n - 1];
      if (lastVal > bb.upper) result.short_term.drivers.push('Price above upper Bollinger Band');
      else if (lastVal < bb.lower) result.short_term.drivers.push('Price below lower Bollinger Band');
      else result.short_term.drivers.push('Price within Bollinger Bands');
    }
  }

  // 5-day and 20-day return
  if (n >= 5) {
    const ret5 = ((vals[n - 1] - vals[n - 5]) / vals[n - 5]) * 100;
    result.short_term.drivers.push(`5-day return: ${ret5.toFixed(2)}%`);
    result.indicators.roc5 = Math.round(ret5 * 100) / 100;
  }
  if (n >= 20) {
    const ret20 = ((vals[n - 1] - vals[n - 20]) / vals[n - 20]) * 100;
    result.medium_term.drivers.push(`20-day return: ${ret20.toFixed(2)}%`);
    result.indicators.roc20 = Math.round(ret20 * 100) / 100;
  }

  // Calculate volatility
  if (n >= 14) {
    const vol = calculateVolatility(vals, 14);
    if (vol) {
      result.indicators.volatility = Math.round(vol * 100) / 100;
      result.indicators.volatilityLevel = vol > 20 ? 'High' : vol > 10 ? 'Medium' : 'Low';
    }
  }

  // Store result
  result.short_term = JSON.stringify(result.short_term);
  result.medium_term = JSON.stringify(result.medium_term);
  result.long_term = JSON.stringify(result.long_term);
  result.indicators = JSON.stringify(result.indicators);

  db.prepare(`
    INSERT INTO market_pulse (price, price_usd, short_term, medium_term, long_term, indicators, chart_data, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    result.price, result.price_usd,
    result.short_term, result.medium_term, result.long_term,
    result.indicators, result.chart_data
  );

  // Keep only last 30 pulses
  db.prepare(`
    DELETE FROM market_pulse WHERE id NOT IN (
      SELECT id FROM market_pulse ORDER BY generated_at DESC LIMIT 30
    )
  `).run();

  console.log('[Pulse] Market pulse calculated');
  return result;
}

// Technical analysis helpers
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  const gains = [];
  const losses = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateMACD(prices) {
  if (prices.length < 26) return null;
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  if (!ema12 || !ema26) return null;
  const macdLine = ema12 - ema26;
  // Signal line: 9-day EMA of MACD
  const macdVals = [];
  for (let i = 25; i < prices.length; i++) {
    const e12 = calculateEMA(prices.slice(0, i + 1), 12);
    const e26 = calculateEMA(prices.slice(0, i + 1), 26);
    if (e12 && e26) macdVals.push(e12 - e26);
  }
  const signalLine = calculateEMA(macdVals, 9);
  return {
    value: Math.round(macdLine * 100) / 100,
    signalLine: signalLine ? Math.round(signalLine * 100) / 100 : 0,
    histogram: signalLine ? Math.round((macdLine - signalLine) * 100) / 100 : 0,
  };
}

function calculateEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateBollinger(prices, period = 20) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: Math.round((mean + 2 * stdDev) * 100) / 100,
    lower: Math.round((mean - 2 * stdDev) * 100) / 100,
    middle: Math.round(mean * 100) / 100,
    pctB: prices[prices.length - 1] ? Math.round(((prices[prices.length - 1] - (mean - 2 * stdDev)) / (4 * stdDev)) * 100) / 100 : 0,
  };
}

function calculateVolatility(prices, period = 14) {
  if (prices.length < period + 1) return null;
  const returns = [];
  for (let i = prices.length - period; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, v) => sum + (v - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(365) * 100;
}

// Run directly
if (process.argv[1]?.includes('pulse-calculator')) {
  calculatePulse();
  console.log('Done');
}
