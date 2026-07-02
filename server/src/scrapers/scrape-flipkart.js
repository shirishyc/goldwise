/**
 * Flipkart Product Scraper
 * Scrapes gold jewellery products from flipkart.com
 */
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT = 25000;
const BRAND = 'Flipkart';
const JEWELLER_SOURCE = 'Flipkart';

const SEARCH_URLS = [
  'https://www.flipkart.com/search?q=gold+jewellery&otracker=search&otracker1=search',
  'https://www.flipkart.com/search?q=gold+coins&otracker=search&otracker1=search',
  'https://www.flipkart.com/search?q=gold+rings&otracker=search&otracker1=search',
  'https://www.flipkart.com/search?q=gold+necklace&otracker=search&otracker1=search',
  'https://www.flipkart.com/search?q=gold+earrings&otracker=search&otracker1=search',
  'https://www.flipkart.com/search?q=gold+bangles&otracker=search&otracker1=search',
  'https://www.flipkart.com/search?q=gold+bar&otracker=search&otracker1=search',
];

function extractKarat(text) {
  if (!text) return '22';
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

export async function scrapeFlipkart(db) {
  const products = [];
  const goldRates = loadGoldRates(db);

  try {
    const seen = new Set();
    for (const searchUrl of SEARCH_URLS) {
      // Derive category from search query
      const queryText = searchUrl.match(/q=([^&]+)/)?.[1] || '';
      const decodedQuery = decodeURIComponent(queryText).toLowerCase();
      let category = 'jewellery';
      if (decodedQuery.includes('coin') || decodedQuery.includes('bar')) {
        category = 'coins_and_bars';
      } else if (decodedQuery.includes('ring')) {
        category = 'rings';
      } else if (decodedQuery.includes('necklace')) {
        category = 'necklaces';
      } else if (decodedQuery.includes('earring')) {
        category = 'earrings';
      } else if (decodedQuery.includes('bangle')) {
        category = 'bangles';
      }

      try {
        console.log(`[Flipkart] Fetching ${searchUrl}`);
        const resp = await fetch(searchUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
            'Referer': 'https://www.flipkart.com/',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!resp.ok) {
          console.warn(`[Flipkart] HTTP ${resp.status} for ${searchUrl}`);
          continue;
        }

        const html = await resp.text();
        if (!html || html.length < 200) continue;

        const $ = cheerio.load(html);

        // Flipkart product selectors
        const productSelectors = [
          '._1AtVbE', // Flipkart's product card container
          '._4ddWXP', // Another Flipkart container
          '.product-unit-holder',
          '.product-grid .item', '.product', '.product-item',
          '[class*="product"]', '[class*="Product"]',
          '._2kHMtA', // product card
          '.tUxRFu', // product list item
          '.cPHDOP', // product card wrapper
          'a[href*="/product/"]',
        ];

        let $products = $([]);
        for (const sel of productSelectors) {
          const found = $(sel);
          if (found.length > 0) {
            // For link selector, filter to ones with images
            if (sel === 'a[href*="/product/"]') {
              const withImgs = found.filter((i, el) => $(el).find('img').length > 0);
              if (withImgs.length > 0) {
                $products = withImgs;
                break;
              }
            }
            $products = found;
            break;
          }
        }

        if ($products.length === 0) {
          // Fallback: find links containing /product/ with images
          const links = [];
          $('a[href*="/product/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href || href.includes('#') || href.includes('javascript')) return;
            const img = $(el).find('img').first();
            const imgSrc = img.attr('src') || img.attr('data-src') || img.attr('data-lazy') || '';
            if (imgSrc) {
              links.push({ href, imgSrc, alt: img.attr('alt') || '', el });
            }
          });

          if (links.length === 0) {
            continue; // No products found
          }

          const seenUrls = new Set();
          for (const pl of links) {
            const fullUrl = pl.href.startsWith('http') ? pl.href : `https://www.flipkart.com${pl.href}`;
            if (seenUrls.has(fullUrl)) continue;
            seenUrls.add(fullUrl);

            const name = pl.alt || $(pl.el).attr('title') || 'Flipkart Gold Product';
            const imgSrc = pl.imgSrc.startsWith('http') ? pl.imgSrc : `https:${pl.imgSrc}`;
            const parent = $(pl.el).closest('[class*="product"], li, [class*="item"], div[class]');
            const priceText = parent.find('[class*="price"]').first().text()
              || parent.find('._30jeq3').first().text()  // Flipkart price class
              || parent.text();
            const price = extractPrice(priceText);

            if (price && !seen.has(fullUrl)) {
              seen.add(fullUrl);
              const allInfo = name + ' ' + pl.alt + ' ' + priceText;
              const goldWeight = extractWeight(allInfo);
              const karat = extractKarat(allInfo);

              const todaysGoldRate = goldRates[karat] || null;
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
            const nameSelectors = ['._4rR01T', '.s1Q9rs', '._3wU53n', '.IRpwTa',
              '.product-title', '.product-name', '.name', 'h2', 'h3', '.title',
              '[class*="name"]', '[class*="title"]'];
            let name = '';
            for (const s of nameSelectors) {
              name = $el.find(s).first().text().trim();
              if (name) break;
            }
            if (!name) name = $el.find('img').first().attr('alt') || 'Flipkart Gold Product';

            // URL
            let productUrl = '';
            if ($el.is('a')) {
              productUrl = $el.attr('href') || '';
            } else {
              const linkEl = $el.find('a[href*="/product/"]').first() || $el.find('a').first();
              productUrl = linkEl.attr('href') || '';
            }
            if (productUrl && !productUrl.startsWith('http')) {
              productUrl = `https://www.flipkart.com${productUrl}`;
            }

            if (!productUrl || seen.has(productUrl)) return;
            seen.add(productUrl);

            // Image
            const imgEl = $el.find('img').first();
            let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy') || '';
            if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : `https://www.flipkart.com${imageUrl}`;
            }

            // Price
            const priceSelectors = ['._30jeq3', '._1_WHN1', '.price', '.product-price',
              '[class*="price"]', '.final-price', '.amount'];
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
        console.warn(`[Flipkart] Error scraping ${searchUrl}:`, err.message);
      }
    }
  } catch (err) {
    console.warn('[Flipkart] Scraper error:', err.message);
  }

  console.log(`[Flipkart] Scraped ${products.length} products`);
  return products;
}

export default scrapeFlipkart;
