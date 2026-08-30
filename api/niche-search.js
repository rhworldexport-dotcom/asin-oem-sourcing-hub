const CATEGORY_BY_KEYWORD = {
  gaming: ['Informatique'],
  'gaming pc': ['Informatique'],
  ssd: ['Informatique'],
  nvme: ['Informatique'],
  informatique: ['Informatique'],
  ordinateur: ['Informatique'],
  computer: ['Informatique'],
  cuisine: ['Cuisine & Maison'],
  auto: ['Auto & Moto'],
  moto: ['Auto & Moto'],
  reseau: ['Informatique'],
  reseaux: ['Informatique']
};

const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'pour', 'avec', 'et', 'en', 'a']);

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value) {
  return normalize(value).split(/\s+/).filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function matchesKeyword(title, keyword, category) {
  const normalizedTitle = normalize(title);
  const normalizedCategory = normalize(category);
  const titleTokens = new Set(tokens(title));
  const queryTokens = tokens(keyword);
  if (!queryTokens.length) return false;
  if (queryTokens.includes('ssd')) {
    const isStorageProduct = /\b(ssd|nvme|m 2|sata|solid state|disque dur externe)\b/.test(normalizedTitle);
    const isComputerProduct = /\b(macbook|ordinateur portable|laptop|notebook|pc portable)\b/.test(normalizedTitle);
    if (!isStorageProduct || isComputerProduct) return false;
  }
  return queryTokens.every(token => titleTokens.has(token) || [...titleTokens].some(titleToken => titleToken.startsWith(token)) || normalizedCategory.includes(token));
}

function getAttributes(item) {
  return item && item.attributes ? item.attributes : {};
}

function normalizeResult(item, keyword) {
  const attributes = getAttributes(item);
  const sellers = Number(attributes.number_of_sellers || 0);
  const price = Number(attributes.price || 0);
  const sales = Number(attributes.approximate_30_day_units_sold || 0);
  const revenue = Number(attributes.approximate_30_day_revenue || 0);
  const title = attributes.title || '';
  const brand = attributes.brand || '';
  const asin = attributes.parent_asin || String(item.id || '').split('/').pop();
  const brandRisk = brand ? 'À vérifier' : 'Inconnu';
  return {
    name: title,
    asin,
    brand,
    price,
    sales,
    revenue,
    sellers,
    rating: Number(attributes.rating || 0),
    reviews: Number(attributes.reviews || 0),
    rank: Number(attributes.product_rank || 0),
    weight: attributes.weight_value == null ? null : Number(attributes.weight_value),
    weightUnit: attributes.weight_unit || null,
    imageUrl: attributes.image_url || '',
    category: attributes.category || '',
    listingQualityScore: Number(attributes.listing_quality_score || 0),
    buyBoxOwner: attributes.buy_box_owner || '',
    privateLabelRisk: 'À vérifier manuellement',
    brandRisk,
    query: keyword
  };
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Méthode non autorisée' });
  if (!process.env.JUNGLE_SCOUT_API_KEY || !process.env.JUNGLE_SCOUT_KEY_NAME) {
    return json(res, 503, { code: 'JUNGLE_SCOUT_NOT_CONFIGURED', error: 'La recherche live nécessite les variables serveur Jungle Scout.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return json(res, 400, { error: 'Le corps de la requête est invalide.' });
  }
  const keyword = String(body.keyword || '').trim();
  const marketplace = String(body.marketplace || 'fr').toLowerCase();
  const limit = Math.min(20, Math.max(10, Number(body.limit) || 10));
  const minPrice = Math.max(0, Number(body.minPrice) || 30);
  const minSellers = 5;
  const categories = CATEGORY_BY_KEYWORD[normalize(keyword)];

  if (!keyword) return json(res, 400, { error: 'Une niche ou un mot-clé est requis.' });
  if (!['us', 'uk', 'de', 'in', 'ca', 'fr', 'it', 'es', 'mx', 'jp'].includes(marketplace)) {
    return json(res, 400, { error: 'Marketplace Amazon non supportée.' });
  }

  const payload = {
    data: {
      type: 'product_database_query',
      attributes: {
        include_keywords: [keyword],
        ...(categories ? { categories } : {}),
        exclude_unavailable_products: true,
        min_price: minPrice,
        sort_base: 'sales',
        sort_order: 'desc',
        page_size: 50
      }
    }
  };

  let response;
  let data;
  try {
    response = await fetch(`https://developer.junglescout.com/api/product_database_query?marketplace=${encodeURIComponent(marketplace)}`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.junglescout.v1+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `${process.env.JUNGLE_SCOUT_KEY_NAME}:${process.env.JUNGLE_SCOUT_API_KEY}`,
        'X-API-Type': 'junglescout'
      },
      body: JSON.stringify(payload)
    });
    data = await response.json();
  } catch (error) {
    return json(res, 502, { error: 'Connexion impossible avec Jungle Scout.', details: error.message });
  }
  if (!response.ok) return json(res, response.status, { error: 'La recherche Jungle Scout a échoué.', details: data });

  const results = (Array.isArray(data.data) ? data.data : [])
    .map(item => normalizeResult(item, keyword))
    .filter(item => matchesKeyword(item.name, keyword, item.category))
    .filter(item => item.sellers >= minSellers)
    .filter(item => item.brand)
    .slice(0, limit);

  return json(res, 200, {
    source: 'Jungle Scout',
    marketplace,
    keyword,
    filters: { minPrice, minSellers, privateLabel: 'manual_review_required', brandRisk: 'manual_review_required' },
    results,
    totalReturned: results.length,
    totalFound: data.meta && data.meta.total_items ? data.meta.total_items : 0,
    warning: 'Le nombre de vendeurs est filtré automatiquement. Le Private Label et le blocage de marque doivent être vérifiés avec GlobalSeller, la marque ou le distributeur officiel.'
  });
};
