const API_BASE = '/api';

async function fetchJSON(url) {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getLiveRates() {
  return fetchJSON('/live-rates');
}

export async function getProducts(params = {}) {
  const q = new URLSearchParams(params).toString();
  return fetchJSON(`/products?${q}`);
}

export async function getProductsSummary() {
  return fetchJSON('/products/summary');
}

export async function getBrands() {
  return fetchJSON('/brands');
}

export async function getCategories() {
  return fetchJSON('/categories');
}

export async function getPulse() {
  return fetchJSON('/pulse');
}

export async function getPulseSummary() {
  return fetchJSON('/pulse/ai-summary');
}

export async function getCompare(params = {}) {
  const q = new URLSearchParams(params).toString();
  return fetchJSON(`/compare?${q}`);
}

export async function getCompareCategories() {
  return fetchJSON('/compare/categories');
}

export async function getNews() {
  return fetchJSON('/news');
}

export async function getHealth() {
  return fetchJSON('/health');
}
