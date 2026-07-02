import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'goldwise.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS gold_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    karat TEXT,
    rate_per_gram REAL,
    rate_per_oz REAL,
    usd_inr REAL,
    metadata TEXT,
    scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_gold_rates_source ON gold_rates(source);
  CREATE INDEX IF NOT EXISTS idx_gold_rates_scraped ON gold_rates(scraped_at);

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    karat TEXT NOT NULL,
    gold_weight REAL,
    gross_weight REAL,
    price REAL NOT NULL,
    making_charges REAL,
    premium_percent REAL,
    effective_price_per_gram REAL,
    spot_gold_value REAL,
    todays_gold_rate REAL,
    best_deal_price REAL,
    product_url TEXT,
    image_url TEXT,
    jeweller_source TEXT NOT NULL,
    brand TEXT NOT NULL,
    coupon_code TEXT,
    price_coupon REAL,
    scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
    sheet_last_updated TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_karat ON products(karat);
  CREATE INDEX IF NOT EXISTS idx_products_jeweller ON products(jeweller_source);
  CREATE INDEX IF NOT EXISTS idx_products_premium ON products(premium_percent);

  CREATE TABLE IF NOT EXISTS market_pulse (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price REAL,
    price_usd REAL,
    short_term TEXT,
    medium_term TEXT,
    long_term TEXT,
    indicators TEXT,
    chart_data TEXT,
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS news_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    link TEXT NOT NULL,
    source TEXT,
    published_at TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS brands (
    name TEXT PRIMARY KEY,
    display_name TEXT,
    tracking_since TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY,
    display_name TEXT
  );
`);

// ---------------------------------------------------------------------------
// Seed default data
// ---------------------------------------------------------------------------
const brandCount = db.prepare('SELECT COUNT(*) as c FROM brands').get();
if (brandCount.c === 0) {
  const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (name, display_name) VALUES (?, ?)');
  const brands = [
    'Angara','Aspect Bullion & Refinery','Augmont','BANGALORE REFINERY','Bangalore Refinery',
    'BHIMA','Bhima Gold','Bhima Jewels','Bluestone','C Krishniah Chetty Jewellers',
    'Candere','CaratLane','Casajoya','Divine Solitaires','Earth Mint','Earthmint',
    'Euphoria Jewellery',"Ghare's",'GRT Jewellers','Joyalukkas','Kalamandir',
    'Kalyan Jewellers','Kundan','l.D.SONS','Lords Jewels','Malabar Gold & Diamonds',
    'Melorra','Mia by Tanishq','MMTC-PAMP','Muthoot Pappachan','Nipura',
    'P N Gadgil Jewellers','Parshwa Padmavati Gold','PC Chandra Jewellers','PMJ Jewels',
    'Reliance Jewels','Riti Jewelry','Sri Jagdamba Pearls','Tanishq','Touch925',
    'WHP Jewellers','Zen Diamond India'
  ];
  for (const b of brands) insertBrand.run(b, b);

  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, display_name) VALUES (?, ?)');
  const cats = [
    ['bangles','Bangles'],['bangles_bracelets','Bangles & Bracelets'],['bracelets','Bracelets'],
    ['brooch','Brooch'],['chains','Chains'],['charms','Charms'],['coins_and_bars','Coins & Bars'],
    ['earrings','Earrings'],['gemstone','Gemstone'],['kollussu','Kollussu'],
    ['mangalsutra','Mangalsutra'],['matty','Matty'],['necklace_sets','Necklace Sets'],
    ['necklaces','Necklaces'],['nose_pins','Nose Pins'],['nosepins','Nose Pins'],
    ['oddiyanam','Oddiyanam'],['pendant_earring_sets','Pendant & Earring Sets'],
    ['pendants','Pendants'],['rings','Rings'],['set_product','Sets'],
    ['solitaires','Solitaires'],['vedhani','Vedhani'],['watch_accessories','Watch Accessories']
  ];
  for (const [k, v] of cats) insertCat.run(k, v);
}

export default db;
