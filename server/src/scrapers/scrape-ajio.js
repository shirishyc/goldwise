/**
 * Ajio Product Scraper
 * Scrapes gold coins and bars from ajio.com
 */
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT = 25000;
const BRAND = 'Ajio';
const JEWELLER_SOURCE = 'Ajio';

// Ajio search URLs for gold coins and bars
const SEARCH_URLS = [
  'https://www.ajio.com/search/?text=gold+coins',
  'https://www.ajio.com/search/?text=gold+bars',
  'https://www.ajio.com/search/?text=24k+gold',
  'https://www.ajio.com/search/?text=gold+jewellery',
];

function extractKarat(text) {
  if (!text) return '24';
  const lower = text.toLowerCase();
  const match = lower.match(/(\d+)\s*k\b/);
  if (match) {
    const k = parseInt(match[1]);
    if ([9, 14, 18, 22, 24].includes(k)) return String(k);
  }
  if (lower.includes('24k') || lower.includes('24 k') || lower.includes('24 karat') || lower.includes('999')) return '24';
  if (lower.includes('22k') || lower.includes('22 k') || lower.includes('22 karat') || lower.includes('916')) return '22';
  if (lower.includes('18k') || lower.includes('18 k')) return '18';
  if (lower.includes('14k') || lower.includes('14 k')) return '14';
  return '24'; // default: coins are typically 24k
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
  // Also try patterns like "10g", "20g" without space
  const match2 = text.match(/(\d+)\s*g\b(?!r)/i);
  if (match2) return parseFloat(match2[1]);
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

export async function scrapeAjio(db) {
  const products = [];
  const goldRates = loadGoldRates(db);

  try {
    const seen = new Set();
    for (const searchUrl of SEARCH_URLS) {
      try {
        // Determine category from search text
        const searchText = searchUrl.match(/text=([^&]+)/)?.[1] || '';
        const category = searchText.includes('coin') ? 'coins_and_bars'
          : searchText.includes('bar') ? 'coins_and_bars'
          : 'jewellery';

        console.log(`[Ajio] Fetching ${searchUrl}`);
        const resp = await fetch(searchUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
            'Referer': 'https://www.ajio.com/',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!resp.ok) {
          console.warn(`[Ajio] HTTP ${resp.status} for ${searchUrl}`);
          continue;
        }

        const html = await resp.text();
        if (!html || html.length < 200) continue;

        const $ = cheerio.load(html);

        // Ajio product selectors
        const productSelectors = [
          '.product-item', '.item.product-item', '.product-card',
          '.product-grid .item', '.product-box', '.product',
          '[class*="product"]', '.ril-product-item', '.plp-product',
          '.product-tile', '.product-unit',
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
          // Fallback: look for links with product images
          const links = [];
          $('a[href*="/product/"], a[href*="/p/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href || href.includes('#') || href.includes('javascript')) return;
            const img = $(el).find('img').first();
            const imgSrc = img.attr('src') || img.attr('data-src') || img.attr('data-lazy') || '';
            if (imgSrc) {
              links.push({ href, imgSrc, alt: img.attr('alt') || '', el });
            }
          });

          const seenUrls = new Set();
          for (const pl of links) {
            const fullUrl = pl.href.startsWith('http') ? pl.href : `https://www.ajio.com${pl.href}`;
            if (seenUrls.has(fullUrl)) continue;
            seenUrls.add(fullUrl);

            const name = pl.alt || $(pl.el).attr('title') || 'Ajio Gold Product';
            const imgSrc = pl.imgSrc.startsWith('http') ? pl.imgSrc : `https:${pl.imgSrc}`;
            const parent = $(pl.el).closest('[class*="product"], li, [class*="item"]');
            const priceText = parent.find('[class*="price"]').first().text()
              || parent.find('[class*="amount"]').first().text()
              || parent.find('.prod-price').first().text();
            const price = extractPrice(priceText);

            if (price && !seen.has(fullUrl)) {
              seen.add(fullUrl);

              // Try to extract weight from name or alt text
              const allInfo = name + ' ' + pl.alt + ' ' + priceText;
              const goldWeight = extractWeight(allInfo);
              const karat = extractKarat(allInfo);

              const todaysGoldRate = goldRates[karat] || goldRates['24'] || null;
              const spotGoldValue = goldWeight && todaysGoldRate ? goldWeight * todaysGoldRate : null;
              const premiumPercent = spotGoldValue && spotGoldValue > 0 ? ((price - spotGoldValue) / spotGoldValue) * 100 : null;
              const effectivePricePerGram = goldWeight && goldWeight > 0 ? price / goldWeight : null;

              products.push({
                name,
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
            const nameSelectors = ['.product-name', '.product-title', '.name', 'h2', 'h3', '.title',
              '[class*="name"]', '[class*="title"]', '.brand-name', '.prod-name'];
            let name = '';
            for (const s of nameSelectors) {
              name = $el.find(s).first().text().trim();
              if (name) break;
            }
            if (!name) name = $el.find('img').first().attr('alt') || 'Ajio Gold Product';

            // URL
            const linkEl = $el.find('a').first();
            let productUrl = linkEl.attr('href') || '';
            if (productUrl && !productUrl.startsWith('http')) {
              productUrl = `https://www.ajio.com${productUrl}`;
            }

            if (!productUrl || seen.has(productUrl)) return;
            seen.add(productUrl);

            // Image
            const imgEl = $el.find('img').first();
            let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy') || '';
            if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : `https://www.ajio.com${imageUrl}`;
            }

            // Price
            const priceSelectors = ['.price', '.product-price', '.special-price', '.regular-price',
              '[class*="price"]', '.amount', '.prod-price', '.final-price'];
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

            const todaysGoldRate = goldRates[karat] || goldRates['24'] || null;
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
        console.warn(`[Ajio] Error scraping ${searchUrl}:`, err.message);
      }
    }
  } catch (err) {
    console.warn('[Ajio] Scraper error:', err.message);
  }

  console.log(`[Ajio] Scraped ${products.length} products`);
  return products;
}

export default scrapeAjio;
