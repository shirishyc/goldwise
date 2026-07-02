/**
 * Bluestone Product Scraper
 * Scrapes gold jewellery product listings from bluestone.com
 */
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT = 25000;
const BRAND = 'Bluestone';
const JEWELLER_SOURCE = 'Bluestone';

const CATEGORY_URLS = [
  'https://www.bluestone.com/jewellery/gold-rings.html',
  'https://www.bluestone.com/jewellery/gold-earrings.html',
  'https://www.bluestone.com/jewellery/gold-necklaces.html',
  'https://www.bluestone.com/jewellery/gold-bangles.html',
  'https://www.bluestone.com/jewellery/gold-pendants.html',
  'https://www.bluestone.com/jewellery/gold-bracelets.html',
  'https://www.bluestone.com/jewellery/gold-chains.html',
];

function extractKarat(text) {
  if (!text) return '22';
  const lower = text.toLowerCase();
  const match = lower.match(/(\d+)\s*k\b/);
  if (match) {
    const k = parseInt(match[1]);
    if ([9, 14, 18, 22, 24].includes(k)) return String(k);
  }
  if (lower.includes('22k') || lower.includes('22 k') || lower.includes('22 karat')) return '22';
  if (lower.includes('18k') || lower.includes('18 k')) return '18';
  if (lower.includes('24k') || lower.includes('24 k')) return '24';
  if (lower.includes('14k') || lower.includes('14 k')) return '14';
  return '22';
}

function extractPrice(text) {
  if (!text) return null;
  const cleaned = text.replace(/[,]/g, '');
  const match = cleaned.match(/₹?\s*(\d+(?:\.\d+)?)/);
  if (match) return parseFloat(match[1]);
  const match2 = cleaned.match(/rs\.?\s*(\d+(?:\.\d+)?)/i);
  if (match2) return parseFloat(match2[1]);
  const match3 = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (match3) return parseFloat(match3[1]);
  return null;
}

function extractWeight(text) {
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:gm|g\b|gram|grams)/i);
  if (match) return parseFloat(match[1]);
  return null;
}

function loadGoldRates(db) {
  const rows = db.prepare(
    "SELECT karat, rate_per_gram FROM gold_rates WHERE source='goodreturns' ORDER BY scraped_at DESC LIMIT 5"
  ).all();
  const rates = {};
  for (const r of rows) {
    const k = r.karat.replace('k', '');
    rates[k] = r.rate_per_gram;
  }
  return rates;
}

export async function scrapeBluestone(db) {
  const products = [];
  const goldRates = loadGoldRates(db);

  try {
    const seen = new Set();
    for (const catUrl of CATEGORY_URLS) {
      const category = catUrl.match(/gold-(\w+)\.html/)?.[1] || 'jewellery';

      try {
        console.log(`[Bluestone] Fetching ${catUrl}`);
        const resp = await fetch(catUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!resp.ok) {
          console.warn(`[Bluestone] HTTP ${resp.status} for ${catUrl}`);
          continue;
        }

        const html = await resp.text();
        if (!html || html.length < 200) continue;

        const $ = cheerio.load(html);

        // Product card selectors for Bluestone
        const productSelectors = [
          '.product-item', '.product-card', '.product-tile', '.item.product-item',
          '.category-products .item', '.product-grid .product-item',
          '.product-listing .item', '.product-box', '.product',
          '[class*="product"]',
        ];

        let $products = $([]);
        for (const sel of productSelectors) {
          const found = $(sel);
          if (found.length > 0) {
            $products = found;
            break;
          }
        }

        if ($products.length === 0) {
          // Fallback: look for structured data or product links
          const links = [];
          $('a[href*="/product/"], a[href*="/jewellery/"], a[href*=".html"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href || href.includes('#') || href.includes('javascript')) return;
            const img = $(el).find('img').first();
            const imgSrc = img.attr('src') || img.attr('data-src') || img.attr('data-lazy') || '';
            if (imgSrc) {
              links.push({ href, imgSrc, alt: img.attr('alt') || '' });
            }
          });

          const seenUrls = new Set();
          for (const pl of links) {
            const fullUrl = pl.href.startsWith('http') ? pl.href : `https://www.bluestone.com${pl.href}`;
            if (seenUrls.has(fullUrl)) continue;
            seenUrls.add(fullUrl);

            const name = pl.alt || 'Bluestone Product';
            const imgSrc = pl.imgSrc.startsWith('http') ? pl.imgSrc : `https:${pl.imgSrc}`;
            const parent = $(`a[href="${pl.href}"]`).closest('[class*="product"], li, div');
            const priceText = parent.find('[class*="price"]').first().text()
              || parent.find('[class*="amount"]').first().text();
            const price = extractPrice(priceText);

            if (price && !seen.has(fullUrl)) {
              seen.add(fullUrl);
              products.push({
                name,
                category,
                karat: '22',
                gold_weight: null,
                gross_weight: null,
                price,
                making_charges: null,
                premium_percent: null,
                effective_price_per_gram: null,
                spot_gold_value: null,
                todays_gold_rate: goldRates['22'] || null,
                product_url: fullUrl,
                image_url: imgSrc || null,
                jeweller_source: JEWELLER_SOURCE,
                brand: BRAND,
              });
            }
          }
          continue;
        }

        $products.each((i, el) => {
          try {
            const $el = $(el);
            const allText = $el.text();

            // Name
            const nameSelectors = ['.product-name', '.product-title', '.name', 'h2', 'h3', '.title', '[class*="name"]', '[class*="title"]'];
            let name = '';
            for (const s of nameSelectors) {
              name = $el.find(s).first().text().trim();
              if (name) break;
            }
            if (!name) name = $el.find('img').first().attr('alt') || 'Bluestone Product';

            // URL
            const linkEl = $el.find('a').first();
            let productUrl = linkEl.attr('href') || '';
            if (productUrl && !productUrl.startsWith('http')) {
              productUrl = `https://www.bluestone.com${productUrl}`;
            }

            if (!productUrl || seen.has(productUrl)) return;
            seen.add(productUrl);

            // Image
            const imgEl = $el.find('img').first();
            let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy') || '';
            if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : `https://www.bluestone.com${imageUrl}`;
            }

            // Price
            const priceSelectors = ['.price', '.product-price', '.special-price', '.regular-price', '[class*="price"]', '.amount'];
            let priceText = '';
            for (const s of priceSelectors) {
              priceText = $el.find(s).first().text().trim();
              if (priceText) break;
            }
            if (!priceText) priceText = allText;
            const price = extractPrice(priceText);
            if (!price) return;

            const karat = extractKarat(allText);
            const goldWeight = extractWeight(allText);

            const todaysGoldRate = goldRates[karat] || null;
            const spotGoldValue = goldWeight && todaysGoldRate ? goldWeight * todaysGoldRate : null;
            const premiumPercent = spotGoldValue && spotGoldValue > 0 ? ((price - spotGoldValue) / spotGoldValue) * 100 : null;
            const effectivePricePerGram = goldWeight && goldWeight > 0 ? price / goldWeight : null;

            products.push({
              name: name.substring(0, 255),
              category,
              karat,
              gold_weight: goldWeight,
              gross_weight: null,
              price,
              making_charges: null,
              premium_percent: premiumPercent !== null ? Math.round(premiumPercent * 100) / 100 : null,
              effective_price_per_gram: effectivePricePerGram !== null ? Math.round(effectivePricePerGram * 100) / 100 : null,
              spot_gold_value: spotGoldValue !== null ? Math.round(spotGoldValue) : null,
              todays_gold_rate: todaysGoldRate,
              product_url: productUrl,
              image_url: imageUrl || null,
              jeweller_source: JEWELLER_SOURCE,
              brand: BRAND,
            });
          } catch (err) {
            // skip individual product errors
          }
        });
      } catch (err) {
        console.warn(`[Bluestone] Error scraping ${catUrl}:`, err.message);
      }
    }
  } catch (err) {
    console.warn('[Bluestone] Scraper error:', err.message);
  }

  console.log(`[Bluestone] Scraped ${products.length} products`);
  return products;
}

export default scrapeBluestone;
