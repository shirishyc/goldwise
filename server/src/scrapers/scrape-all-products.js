/**
 * Master Product Scraper
 * Runs all 7 brand scrapers in parallel and stores results in the DB.
 * Usage: node src/scrapers/scrape-all-products.js
 */
import db from '../db.js';
import { scrapeTanishq } from './scrape-tanishq.js';
import { scrapeCaratLane } from './scrape-caratlane.js';
import { scrapeBluestone } from './scrape-bluestone.js';
import { scrapeCandere } from './scrape-candere.js';
import { scrapeBhimaGold } from './scrape-bhima-gold.js';
import { scrapeAjio } from './scrape-ajio.js';
import { scrapeFlipkart } from './scrape-flipkart.js';

const SCRAPERS = [
  { name: 'Tanishq', fn: scrapeTanishq },
  { name: 'CaratLane', fn: scrapeCaratLane },
  { name: 'Bluestone', fn: scrapeBluestone },
  { name: 'Candere', fn: scrapeCandere },
  { name: 'Bhima Gold', fn: scrapeBhimaGold },
  { name: 'Ajio', fn: scrapeAjio },
  { name: 'Flipkart', fn: scrapeFlipkart },
];

const SCRAPER_TIMEOUT = 30000; // 30 seconds per scraper

/**
 * Run a single scraper with timeout.
 */
async function runWithTimeout(name, scraperFn, dbInstance, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[Master] ${name} timed out after ${timeoutMs}ms`);
      resolve([]);
    }, timeoutMs);

    scraperFn(dbInstance)
      .then((result) => {
        clearTimeout(timer);
        resolve(Array.isArray(result) ? result : []);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.warn(`[Master] ${name} failed:`, err.message);
        resolve([]);
      });
  });
}

/**
 * Insert scraped products into the database using INSERT OR REPLACE,
 * matching on product_url as the unique key.
 */
function insertProducts(products, sourceName) {
  if (!products || products.length === 0) {
    console.log(`[Master] ${sourceName}: 0 products to insert`);
    return 0;
  }

  const insert = db.prepare(`
    INSERT OR REPLACE INTO products
      (name, category, karat, gold_weight, gross_weight, price,
       making_charges, premium_percent, effective_price_per_gram,
       spot_gold_value, todays_gold_rate, product_url, image_url,
       jeweller_source, brand, scraped_at)
    VALUES
      (@name, @category, @karat, @gold_weight, @gross_weight, @price,
       @making_charges, @premium_percent, @effective_price_per_gram,
       @spot_gold_value, @todays_gold_rate, @product_url, @image_url,
       @jeweller_source, @brand, datetime('now'))
  `);

  const insertMany = db.transaction((batch) => {
    let count = 0;
    for (const p of batch) {
      try {
        insert.run({
          name: String(p.name || '').substring(0, 255),
          category: String(p.category || 'jewellery').substring(0, 100),
          karat: String(p.karat || '22').substring(0, 5),
          gold_weight: p.gold_weight ?? null,
          gross_weight: p.gross_weight ?? null,
          price: p.price ?? 0,
          making_charges: p.making_charges ?? null,
          premium_percent: p.premium_percent ?? null,
          effective_price_per_gram: p.effective_price_per_gram ?? null,
          spot_gold_value: p.spot_gold_value ?? null,
          todays_gold_rate: p.todays_gold_rate ?? null,
          product_url: String(p.product_url || '').substring(0, 1024),
          image_url: String(p.image_url || '').substring(0, 1024),
          jeweller_source: String(p.jeweller_source || sourceName).substring(0, 100),
          brand: String(p.brand || sourceName).substring(0, 100),
        });
        count++;
      } catch (err) {
        console.warn(`[Master] Insert error for ${p.product_url}: ${err.message}`);
      }
    }
    return count;
  });

  const inserted = insertMany(products);
  console.log(`[Master] ${sourceName}: ${inserted} products inserted/updated`);
  return inserted;
}

/**
 * Main function: run all scrapers in parallel and persist results.
 */
export async function scrapeAllProducts(dbInstance) {
  const dbToUse = dbInstance || db;
  console.log('[Master] Starting all product scrapers...');
  console.log(`[Master] Running ${SCRAPERS.length} scrapers with ${SCRAPER_TIMEOUT / 1000}s timeout each`);

  const results = await Promise.all(
    SCRAPERS.map((s) => runWithTimeout(s.name, s.fn, dbToUse, SCRAPER_TIMEOUT))
  );

  console.log('\n[Master] ===== Scraping Results =====');
  let totalProducts = 0;
  for (let i = 0; i < SCRAPERS.length; i++) {
    const scraperName = SCRAPERS[i].name;
    const products = results[i];
    const count = products.length;
    totalProducts += count;
    console.log(`  ${scraperName}: ${count} products scraped`);

    // Insert into DB
    insertProducts(products, scraperName);
  }
  console.log(`[Master] Total: ${totalProducts} products scraped across all sources`);
  console.log('[Master] =============================\n');

  return { total: totalProducts, results: Object.fromEntries(SCRAPERS.map((s, i) => [s.name, results[i]])) };
}

// Run directly: node src/scrapers/scrape-all-products.js
if (process.argv[1] && (process.argv[1].includes('scrape-all-products') || process.argv[1].endsWith('scrape-all-products.js'))) {
  scrapeAllProducts(db)
    .then((result) => {
      console.log(`[Master] Done. ${result.total} products total.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Master] Fatal error:', err);
      process.exit(1);
    });
}

export default scrapeAllProducts;
