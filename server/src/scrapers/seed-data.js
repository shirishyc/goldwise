/**
 * Seed Data Generator
 * Generates realistic sample product data so the app works immediately
 */
import db from '../db.js';

const jewellers = ['Tanishq', 'CaratLane', 'Bluestone', 'Bhima Gold', 'Candere', 'Melorra', 'Ajio', 'Myntra', 'Flipkart'];
const categories = ['bangles', 'necklaces', 'earrings', 'rings', 'pendants', 'chains', 'bracelets', 'coins_and_bars', 'mangalsutra'];
const karats = ['24', '22', '18', '14'];
const brands = ['Tanishq', 'CaratLane', 'Bluestone', 'Bhima Gold', 'Candere', 'Melorra', 'MMTC-PAMP', 'Augmont', 'Bangalore Refinery'];

const productNames = {
  bangles: ['Floral Gold Bangles', 'Traditional Gold Bangles', 'Temple Gold Bangles', 'Designer Gold Bangles', 'Plain Gold Bangles'],
  necklaces: ['Gold Mango Necklace', 'Temple Gold Necklace', 'Gold Chain Necklace', 'Diamond Gold Necklace', 'Gold Pendant Necklace'],
  earrings: ['Gold Stud Earrings', 'Gold Drop Earrings', 'Gold Jhumka Earrings', 'Gold Hoop Earrings', 'Gold Chandbali Earrings'],
  rings: ['Gold Solitaire Ring', 'Gold Band Ring', 'Gold Diamond Ring', 'Gold Signet Ring', 'Gold Couple Ring'],
  pendants: ['Gold Om Pendant', 'Gold Ganesh Pendant', 'Gold Laxmi Pendant', 'Gold Cross Pendant', 'Gold Heart Pendant'],
  chains: ['Gold Rope Chain', 'Gold Figaro Chain', 'Gold Curb Chain', 'Gold Snake Chain', 'Gold Singapore Chain'],
  bracelets: ['Gold Tennis Bracelet', 'Gold Link Bracelet', 'Gold Bangle Bracelet', 'Gold Chain Bracelet', 'Gold Cuff Bracelet'],
  coins_and_bars: ['Gold Lakshmi Coin', 'Gold Ganesh Coin', 'Gold Coin 10g', 'Gold Bar 20g', 'Gold Biscuit 50g'],
  mangalsutra: ['Gold Mangalsutra', 'Diamond Mangalsutra', 'Traditional Mangalsutra', 'Modern Mangalsutra'],
};

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function seedProducts(count = 200) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM products').get();
  if (existing.c > 10) {
    console.log(`[Seed] ${existing.c} products already exist, skipping seed`);
    return;
  }

  console.log(`[Seed] Generating ${count} sample products...`);
  const insert = db.prepare(`
    INSERT INTO products (name, category, karat, gold_weight, gross_weight, price, making_charges,
      premium_percent, effective_price_per_gram, spot_gold_value, todays_gold_rate,
      product_url, image_url, jeweller_source, brand, coupon_code, price_coupon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Current approximate gold rates per karat
  const baseRates = { '24': 14378, '22': 13180, '18': 10784, '14': 8387 };

  const batch = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const category = pickRandom(categories);
      const karat = pickRandom(karats);
      const jeweller = pickRandom(jewellers);
      const brand = pickRandom(brands);
      const name = pickRandom(productNames[category] || productNames.bangles);
      const goldWeight = randomBetween(1, 20);
      const grossWeight = Math.random() > 0.3 ? goldWeight + randomBetween(0.1, 2) : null;
      const baseRate = baseRates[karat] || 14378;
      const spotValue = Math.round(goldWeight * baseRate);

      // Premium varies by jeweller and category
      let premiumPercent;
      if (jeweller === 'Bhima Gold' || jeweller === 'MMTC-PAMP') {
        premiumPercent = randomBetween(3, 15);
      } else if (jeweller === 'Tanishq' || jeweller === 'CaratLane') {
        premiumPercent = randomBetween(8, 25);
      } else if (category === 'coins_and_bars') {
        premiumPercent = randomBetween(3, 12);
      } else {
        premiumPercent = randomBetween(5, 30);
      }
      // Sometimes generate negative premium (deals below spot)
      if (Math.random() < 0.02) premiumPercent = randomBetween(-5, 2);

      const price = Math.round(spotValue * (1 + premiumPercent / 100));
      const effectivePricePerGram = Math.round((price / goldWeight) * 100) / 100;
      const makingCharges = Math.round(price - spotValue);

      // Random coupon codes
      const couponCodes = ['GOLD10', 'FESTIVE5', 'DHANVARSHA', null, 'WELCOME15', null, null, null];
      const coupon = pickRandom(couponCodes);
      const couponDiscount = coupon ? Math.round(price * randomBetween(0.02, 0.08)) : null;
      const priceCoupon = couponDiscount ? price - couponDiscount : null;

      insert.run(
        name + (i > 0 ? ` ${i}` : ''),
        category, `${karat}`, goldWeight, grossWeight, price,
        makingCharges > 0 ? makingCharges : null,
        Math.round(premiumPercent * 100) / 100,
        effectivePricePerGram, spotValue, baseRate,
        `https://example.com/product/${i}`,
        `https://placehold.co/400x400/amber/white?text=Gold`,
        jeweller, brand,
        coupon, priceCoupon
      );
    }
  });

  batch();
  console.log(`[Seed] Inserted ${count} sample products`);
}

// Run directly
if (process.argv[1]?.includes('seed-data')) {
  seedProducts(parseInt(process.argv[2]) || 200);
  console.log('Done');
}
