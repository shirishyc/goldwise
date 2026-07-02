/**
 * Tanishq Product Scraper
 * Scrapes gold jewellery product listings from tanishq.co.in
 */
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT = 25000;
const BRAND = 'Tanishq';
const JEWELLER_SOURCE = 'Tanishq';

// Product category URL paths on Tanishq
const CATEGORY_URLS = [
  'https://www.tanishq.co.in/jewellery/bangles',
  'https://www.tanishq.co.in/jewellery/earrings',
  'https://www.tanishq.co.in/jewellery/necklaces',
  'https://www.tanishq.co.in/jewellery/rings',
  'https://www.tanishq.co.in/jewellery/pendants',
  'https://www.tanishq.co.in/jewellery/bracelets',
  'https://www.tanishq.co.in/jewellery/chains',
  'https://www.tanishq.co.in/jewellery/mangalsutra',
];

/**
 * Parse karat from a product title or description string
 */
function extractKarat(text) {
  if (!text) return '22';
  const lower = text.toLowerCase();
  const match = lower.match(/(\d+)\s*k\b/);
  if (match) {
    const k = parseInt(match[1]);
    if ([9, 14, 18, 22, 24].includes(k)) return String(k);
  }
  if (lower.includes('22k') || lower.includes('22 k')) return '22';
  if (lower.includes('18k') || lower.includes('18 k')) return '18';
  if (lower.includes('24k') || lower.includes('24 k')) return '24';
  if (lower.includes('14k') || lower.includes('14 k')) return '14';
  return '22'; // default assumption for Indian jewellery
}

/**
 * Parse a numeric price from a string like "₹ 1,23,456" or "Rs. 1,23,456"
 */
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

/**
 * Extract weight in grams from text like "2.5 gm", "2.5 g", "2.5 gram"
 */
function extractWeight(text) {
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:gm|g\b|gram|grams)/i);
  if (match) return parseFloat(match[1]);
  return null;
}

/**
 * Load gold rates from DB for premium calculation
 */
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

export async function scrapeTanishq(db) {
  const products = [];
  const goldRates = loadGoldRates(db);

  try {
    const seen = new Set();
    for (const catUrl of CATEGORY_URLS) {
      // Derive category name from URL
      const category = catUrl.split('/').pop() || 'jewellery';

      try {
        console.log(`[Tanishq] Fetching ${catUrl}`);
        const resp = await fetch(catUrl, {
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!resp.ok) {
          console.warn(`[Tanishq] HTTP ${resp.status} for ${catUrl}`);
          continue;
        }

        const html = await resp.text();
        if (!html || html.length < 200) continue;

        const $ = cheerio.load(html);

        // Try multiple common product card selectors
        const productSelectors = [
          '.product-item', '.product-card', '.product-tile', '.plp-card',
          '[data-product-item]', '.category-products li', '.item.product-item',
          '.product-grid .item', '.product-list .product', '.col-product',
          'article.product', '.product', '.product-box', '.grid-product',
          '.product-block', '.product-listing-item', '.product-unit',
          // Generic fallback: look for product links with images
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

        // If still empty, try to find any reasonable product-like elements
        if ($products.length === 0) {
          // Look for links that might be product links
          const productLinks = [];
          $('a[href*="/product/"], a[href*="/products/"], a[href*="/jewellery/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('#') && !href.includes('javascript')) {
              const img = $(el).find('img').first();
              const imgSrc = img.attr('src') || img.attr('data-src') || '';
              if (imgSrc) {
                productLinks.push({ el, href, imgSrc });
              }
            }
          });
          // Deduplicate by URL
          const seenUrls = new Set();
          for (const pl of productLinks) {
            const fullUrl = pl.href.startsWith('http') ? pl.href : `https://www.tanishq.co.in${pl.href}`;
            if (seenUrls.has(fullUrl)) continue;
            seenUrls.add(fullUrl);

            const name = $(pl.el).attr('title') || $(pl.el).find('img').attr('alt') || 'Tanishq Product';
            const imgSrc = pl.imgSrc.startsWith('http') ? pl.imgSrc : `https:${pl.imgSrc}`;
            const priceText = $(pl.el).closest('[class*="product"]').find('[class*="price"]').first().text() || '';
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
          continue; // skip structured parsing since we did fallback
        }

        $products.each((i, el) => {
          try {
            const $el = $(el);

            // Product name
            const nameSelectors = ['.product-name', '.product-title', '.name', 'h2', 'h3', '.title', '[class*="name"]', '[class*="title"]'];
            let name = '';
            for (const s of nameSelectors) {
              name = $el.find(s).first().text().trim();
              if (name) break;
            }
            if (!name) name = $el.find('img').first().attr('alt') || 'Tanishq Product';

            // Product URL
            const linkEl = $el.find('a').first();
            let productUrl = linkEl.attr('href') || '';
            if (productUrl && !productUrl.startsWith('http')) {
              productUrl = `https://www.tanishq.co.in${productUrl}`;
            }

            // Deduplicate
            if (!productUrl || seen.has(productUrl)) return;
            seen.add(productUrl);

            // Image
            const imgEl = $el.find('img').first();
            let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';
            if (imageUrl && !imageUrl.startsWith('http') && imageUrl.startsWith('//')) {
              imageUrl = `https:${imageUrl}`;
            } else if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = `https://www.tanishq.co.in${imageUrl}`;
            }

            // Price
            const priceSelectors = ['.price', '.product-price', '.special-price .price', '.regular-price', '[class*="price"]', '.amount'];
            let priceText = '';
            for (const s of priceSelectors) {
              priceText = $el.find(s).first().text().trim();
              if (priceText) break;
            }
            if (!priceText) priceText = $el.text();
            const price = extractPrice(priceText);

            if (!price) return; // skip if no price

            // Karat
            const allText = $el.text();
            const karat = extractKarat(allText);

            // Gold weight
            const weightTextSelectors = ['.weight', '.product-weight', '[class*="weight"]', '.gold-weight', '[class*="gold"]'];
            let weightText = '';
            for (const s of weightTextSelectors) {
              weightText = $el.find(s).first().text().trim();
              if (weightText) break;
            }
            if (!weightText) weightText = allText;
            const goldWeight = extractWeight(weightText);

            // Calculate derived fields
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
            // skip individual product parse errors
          }
        });
      } catch (err) {
        console.warn(`[Tanishq] Error scraping ${catUrl}:`, err.message);
      }
    }
  } catch (err) {
    console.warn('[Tanishq] Scraper error:', err.message);
  }

  console.log(`[Tanishq] Scraped ${products.length} products`);
  return products;
}

export default scrapeTanishq;
