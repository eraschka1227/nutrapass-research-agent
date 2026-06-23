// Cloudflare Worker prototype for NutraPass AI-assisted educational responses.
// Deploy with OPENAI_API_KEY stored as a Worker secret — never expose it in the HTML page.
// Example: wrangler secret put OPENAI_API_KEY

const ALLOWED_ORIGINS_DEFAULT = [
  'https://nutrapass.club',
  'https://www.nutrapass.club',
  'https://nutrapass-widget.pages.dev'
];

const MAX_BODY_BYTES = 32 * 1024;

function allowedOrigins(env) {
  const raw = env && env.ALLOWED_ORIGINS ? String(env.ALLOWED_ORIGINS) : '';
  const fromEnv = raw.split(',').map((origin) => origin.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : ALLOWED_ORIGINS_DEFAULT;
}

function pickOrigin(request, env) {
  const list = allowedOrigins(env);
  const origin = request.headers.get('Origin') || '';
  return list.includes(origin) ? origin : list[0];
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function privacyHeaders(origin) {
  return {
    ...corsHeaders(origin),
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

const PRODUCT_CATALOG = [
  { name: 'H2O Electrolytes', brand: 'Cellutrex', category: 'hydration / electrolyte support', allowedUse: 'supports hydration balance, especially with sweating, exercise, travel, or low-carb eating patterns' },
  { name: 'Build - Strength & Muscle', brand: 'Silver Fern', category: 'strength / recovery support', allowedUse: 'supports protein, training, and recovery routines' },
  { name: 'Stress Complex', brand: 'Silver Fern', category: 'stress and sleep support', allowedUse: 'supports calm routines and normal relaxation' },
  { name: 'Ultimate Wellness Bundle', brand: 'Silver Fern', category: 'daily wellness foundation', allowedUse: 'supports broad daily wellness coverage' },
  { name: 'Complete Biotic Kit', brand: 'Silver Fern', category: 'microbiome support', allowedUse: 'supports prebiotic, probiotic, and postbiotic gut-health routines' },
  { name: 'Upper & Lower GI Support Kit', brand: 'Silver Fern', category: 'digestive comfort', allowedUse: 'supports digestive comfort after meals' },
  { name: 'Bloat Relief Kit', brand: 'Silver Fern', category: 'bloat/gas support', allowedUse: 'supports digestive comfort and food-tolerance routines' },
  { name: 'Motility - Constipation Support', brand: 'Silver Fern', category: 'regularity support', allowedUse: 'supports normal bowel regularity routines' },
  { name: 'Hair Skin & Nails', brand: 'Silver Fern', category: 'beauty support', allowedUse: 'supports normal hair, skin, and nail structure' },
  { name: 'Joint Complex', brand: 'Silver Fern', category: 'mobility support', allowedUse: 'supports joint comfort and mobility routines' }
];

const PRODUCT_BRANDS = {
  'H2O Electrolytes': 'Cellutrex',
  'Ultimate Wellness Bundle': 'Silver Fern',
  'Cleanse - Daily Gut Detox': 'Silver Fern',
  'Body Composition Kit': 'Silver Fern',
  'Immune+ Protocol': 'Silver Fern',
  'Complete Biotic Kit': 'Silver Fern',
  'Upper & Lower GI Support Kit': 'Silver Fern',
  'K2-D3 Bone & Heart Support': 'Silver Fern',
  'Ultimate Probiotic Bundle': 'Silver Fern',
  'Hair Complex - Keratin & Silica': 'Silver Fern',
  'Whole Food Multivitamin': 'Silver Fern',
  'Joint Complex': 'Silver Fern',
  'Hair Skin & Nails': 'Silver Fern',
  'Bloat Relief Kit': 'Silver Fern',
  'Upper GI Relief': 'Silver Fern',
  'Motility - Constipation Support': 'Silver Fern',
  'Reflux Plus Kit': 'Silver Fern',
  'Gut Rehab Kit': 'Silver Fern',
  'Metabolism Supplement': 'Silver Fern',
  'Gut Repair': 'Silver Fern',
  'Bloat & Gas Relief': 'Silver Fern',
  'Ultimate Fiber': 'Silver Fern',
  'Regularity': 'Silver Fern',
  'Postbiotic+': 'Silver Fern',
  'Stress Complex': 'Silver Fern',
  'Sensitive Gut Fiber': 'Silver Fern',
  'Build - Strength & Muscle': 'Silver Fern',
  'Build Up Protocol': 'Silver Fern',
  'The Burnout Kit': 'Silver Fern',
  'Digestive Enzyme': 'Silver Fern'
};

function productBrand(name, fallback = '') {
  return PRODUCT_BRANDS[name] || fallback || '';
}

function normalizeStoreDomain(domain) {
  return String(domain || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function normalizeShopifyProduct(node = {}) {
  const variant = node.variants?.edges?.[0]?.node || {};
  const price = variant.price?.amount ? `$${Number(variant.price.amount).toFixed(2)}` : '';
  const image = node.featuredImage || node.images?.edges?.[0]?.node || {};
  const tags = Array.isArray(node.tags) ? node.tags.join(' ') : '';
  const url = node.onlineStoreUrl || (node.handle ? `https://nutrapass.club/products/${node.handle}` : '');
  return {
    name: node.title || '',
    n: node.title || '',
    brand: node.vendor || productBrand(node.title, ''),
    p: price,
    price,
    u: url,
    url,
    imageUrl: image.url || '',
    img: image.url || '',
    w: node.productType || node.vendor || 'Available on NutraPass',
    why: node.productType || node.vendor || 'Available on NutraPass',
    k: `${node.title || ''} ${node.vendor || ''} ${node.productType || ''} ${tags} ${node.description || ''}`.toLowerCase(),
    source: 'shopify_live'
  };
}

function staticCatalogProducts() {
  return PRODUCT_CATALOG.map((p) => ({
    name: p.name,
    n: p.name,
    brand: p.brand || productBrand(p.name, ''),
    p: '',
    price: '',
    u: `https://nutrapass.club/search?q=${encodeURIComponent(p.name)}`,
    url: `https://nutrapass.club/search?q=${encodeURIComponent(p.name)}`,
    imageUrl: '',
    img: '',
    w: p.allowedUse || p.category || 'Available on NutraPass',
    why: p.allowedUse || p.category || 'Available on NutraPass',
    k: `${p.name} ${p.brand || ''} ${p.category || ''} ${p.allowedUse || ''}`.toLowerCase(),
    source: 'fallback_static_catalog'
  }));
}

const PRODUCT_CATALOG_CACHE_KEY = 'nutrapass:product-catalog:v1';
const PRODUCT_CATALOG_CACHE_TTL_SECONDS = 60 * 60 * 36;
const COMMON_RESPONSE_CACHE_PREFIX = 'nutrapass:common-response:v6:';
const QUESTION_ANALYTICS_PREFIX = 'nutrapass:question-analytics:v1:';
const DAILY_ANALYTICS_PREFIX = 'nutrapass:analytics:daily:v1:';
const COMMON_RESPONSE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

const COMMON_INTENT_RESPONSES = {
  gut_health: {
    keywords: ['gut', 'bloat', 'bloating', 'digestion', 'digestive', 'microbiome', 'regularity', 'fiber', 'constipation', 'probiotic', 'prebiotic'],
    summary: 'For everyday gut support, start with the basics: fiber diversity, hydration, meal rhythm, and products that support regularity or microbiome balance.',
    overview: 'Nutritional Key Points: everyday gut-support goals often overlap with fiber diversity, meal rhythm, hydration, stress load, food tolerance, motility, and microbiome balance. Persistent, severe, bloody, or unexplained digestive symptoms deserve professional guidance.\n\nFood first: build a steady base with oats, beans/lentils as tolerated, cooked vegetables, fruit such as kiwi or berries, fermented foods if tolerated, enough fluids, and gradual fiber increases rather than sudden big changes.\n\nEasy things to try: walk 5–10 minutes after meals, slow down meal pace, track obvious trigger foods, introduce one fiber/probiotic/enzyme change at a time, and compare products by strain, fiber type, serving size, and tolerance.',
    ingredients: ['prebiotic fiber', 'probiotics', 'postbiotics', 'digestive enzymes', 'ginger or peppermint-style digestive support'],
    followUps: ['Is your main goal regularity, bloating comfort, or daily microbiome support?', 'Any major food triggers you already know about?']
  },
  sleep_stress: {
    keywords: ['sleep', 'stress', 'calm', 'relax', 'relaxation', 'cortisol', 'night', 'bedtime', 'anxiety', 'menopause', 'perimenopause', 'hot flashes', 'night sweats'],
    summary: 'For sleep and stress routines, look at calming habits first, then products that support normal relaxation and sleep quality.',
    overview: 'Nutritional Key Points: sleep and stress patterns can be shaped by caffeine timing, inconsistent sleep/wake rhythm, evening light exposure, high stress load, under-eating, low protein, magnesium intake, alcohol, overtraining, and mood or thyroid/iron/B12 issues.\n\nFood first: anchor protein at meals, include magnesium-rich foods such as pumpkin seeds, spinach, beans, or nuts, use steady hydration, and consider complex carbs at dinner if tolerated.\n\nEasy things to try: set a consistent wind-down window, dim screens/lights before bed, get morning daylight, keep late caffeine modest, and compare calming products by daytime vs bedtime fit, sedation risk, and medication context.',
    ingredients: ['magnesium', 'L-theanine', 'adaptogens', 'glycine', 'sleep routine support'],
    followUps: ['Is the bigger issue falling asleep, staying asleep, or daytime stress?', 'Are you looking for non-sedating daytime support or bedtime support?']
  },
  electrolytes: {
    keywords: ['electrolyte', 'electrolytes', 'hydration', 'sodium', 'potassium', 'magnesium', 'sweat', 'cramps', 'salty'],
    summary: 'For hydration support, compare electrolyte products by sodium level, taste, sugar/carbs, and whether you need daily hydration or exercise-focused support.',
    overview: 'Nutritional Key Points: hydration-support needs can be driven by sweating, heat, travel, low-carb eating patterns, long workouts, illness recovery, alcohol, or simply low fluid/mineral intake. Kidney, blood-pressure, or heart concerns deserve professional guidance before increasing electrolytes.\n\nFood first: use regular fluids, water-rich foods, salted meals when appropriate, fruits/vegetables for potassium, and balanced meals before relying on powders.\n\nEasy things to try: match electrolytes to the situation — daily hydration, heat, travel, or training — and compare sodium level, sugar/carbs, magnesium content, taste, and whether you actually feel better using it.',
    ingredients: ['sodium', 'potassium', 'magnesium', 'chloride'],
    followUps: ['Is this for daily hydration, workouts, heat, travel, or low-carb eating?', 'Do you want sugar-free electrolytes or carbs plus electrolytes?']
  },
  protein: {
    keywords: ['protein', 'bar', 'bars', 'snack', 'muscle', 'recovery', 'strength', 'body composition'],
    summary: 'For protein support, match the product to the use case: quick snack, post-workout recovery, muscle support, or daily protein gap filling.',
    overview: 'Nutritional Key Points: protein-support goals often reflect meal gaps, training recovery needs, low-satiety snacks, busy schedules, or body-composition goals. Product fit depends on total protein, calories, fiber, sweeteners, dairy tolerance, and whether it is replacing a snack or supporting recovery.\n\nFood first: build meals around protein-rich foods such as Greek yogurt, eggs, fish, poultry, tofu/tempeh, beans, lentils, or lean meats, plus fiber-rich carbs and produce.\n\nEasy things to try: aim for a protein-forward breakfast, compare bars/powders by grams of protein per serving and ingredient tolerance, and use products to fill realistic gaps rather than crowding out whole foods.',
    ingredients: ['whey or plant protein', 'essential amino acids', 'fiber', 'creatine where appropriate'],
    followUps: ['Do you want a snack/bar, powder, or recovery product?', 'Any dairy, sweetener, or texture preferences?']
  },
  creatine: {
    keywords: ['creatine', 'strength', 'power', 'lifting', 'muscle', 'performance'],
    summary: 'Creatine is commonly used to support strength, power, and training performance routines.',
    overview: 'Nutritional Key Points: creatine questions usually connect to strength, power, repeated sprint performance, lean-mass support, or training consistency. Fit depends on kidney/medication context, dose consistency, form, flavor tolerance, and whether the basics of lifting, protein, hydration, and sleep are already in place.\n\nFood first: keep protein distributed across meals, include enough total calories for training goals, hydrate consistently, and use carbohydrate around harder sessions if performance is dipping.\n\nEasy things to try: compare simple creatine monohydrate first, look for 3–5 g/day serving clarity, take it consistently, and ask a qualified professional first if kidney disease, pregnancy/nursing, or relevant medications are in play.',
    ingredients: ['creatine monohydrate', 'protein', 'electrolytes'],
    followUps: ['Is this for lifting, sports performance, or general body composition support?', 'Do you prefer flavored or unflavored?']
  },
  running_fuel: {
    keywords: ['running', 'run', 'runner', 'endurance', 'fuel', 'carbs', 'salty carbs', 'race', 'marathon', 'cycling'],
    summary: 'For running fuel, look for easy-to-use carbs, electrolytes, and recovery support matched to the duration and intensity of the effort.',
    overview: 'Nutritional Key Points: running-fuel needs depend on session length, sweat rate, gut tolerance, intensity, heat, and whether the goal is during-run energy, hydration, or recovery. Under-fueling can show up as fading pace, cravings, headaches, or poor recovery.\n\nFood first: for shorter easy runs, regular meals and hydration may be enough; for longer or harder efforts, plan familiar carbs, fluids, sodium, and post-run protein.\n\nEasy things to try: practice fuel before race day, compare products by carbs per serving, sodium, texture, caffeine, and stomach tolerance, and adjust based on duration rather than using the same plan for every run.',
    ingredients: ['carbohydrates', 'sodium', 'electrolytes', 'protein for recovery'],
    followUps: ['How long are the runs or races?', 'Do you want during-run fuel, recovery, or both?']
  },
  beauty: {
    keywords: ['hair', 'skin', 'nails', 'beauty', 'collagen', 'vitamin c', 'vegan collagen'],
    summary: 'For hair, skin, and nail support, compare products that support normal structure, collagen-building nutrients, antioxidant support, and daily nutrient coverage.',
    overview: 'Nutritional Key Points: hair, skin, and nail goals can overlap with protein intake, iron/zinc status, essential fatty acids, thyroid or hormone changes, stress load, collagen support, skin-barrier habits, and normal growth cycles. Sudden hair loss or major skin changes should be evaluated.\n\nFood first: prioritize adequate protein, vitamin-C foods, eggs/fish/lean meats or legumes, nuts/seeds, colorful produce, omega-3-rich foods, and enough calories overall.\n\nEasy things to try: stay consistent for 8–12+ weeks, avoid crash dieting, simplify harsh hair/skin routines, compare products by dose and overlap, and remember high-dose biotin can interfere with lab tests.',
    ingredients: ['vitamin C', 'silica', 'biotin', 'amino acids', 'antioxidants'],
    followUps: ['Are you focused more on skin glow, nails, or hair support?', 'Do you prefer vegan options?']
  },
  immune: {
    keywords: ['immune', 'immunity', 'vitamin c', 'zinc', 'sick', 'seasonal'],
    summary: 'For immune support, start with sleep, protein, micronutrient coverage, and targeted nutrients like vitamin C, D, and zinc when appropriate.',
    overview: 'Nutritional Key Points: immune-support needs are often shaped by sleep quality, stress load, vitamin D status, protein intake, gut health, hydration, seasonal exposure, and overall diet quality. Frequent, severe, or prolonged infections should be discussed with a clinician.\n\nFood first: focus on colorful fruits/vegetables, citrus or berries, protein with each meal, zinc foods like seafood, meat, beans, or pumpkin seeds, fermented foods if tolerated, and steady hydration.\n\nEasy things to try: prioritize sleep, wash hands, keep workouts moderate when run down, get daylight when possible, compare gut-immune products thoughtfully, and avoid megadosing single nutrients for long periods.',
    ingredients: ['vitamin C', 'vitamin D', 'zinc', 'probiotics', 'multivitamin support'],
    followUps: ['Is this daily immune support or short-term seasonal support?', 'Are you already taking vitamin D or zinc?']
  }
};

const COMMON_INTENT_KEYS = Object.keys(COMMON_INTENT_RESPONSES);

async function readCachedProductCatalog(env) {
  if (!env.PRODUCT_CATALOG_KV || !env.PRODUCT_CATALOG_KV.get) return null;
  const raw = await env.PRODUCT_CATALOG_KV.get(PRODUCT_CATALOG_CACHE_KEY, 'json');
  if (!raw || !Array.isArray(raw.products) || !raw.products.length) return null;
  return {
    products: raw.products,
    mode: 'cached_shopify_catalog',
    source: raw.source || 'kv',
    lastSyncedAt: raw.lastSyncedAt || null,
    productCount: raw.products.length
  };
}

async function writeCachedProductCatalog(env, catalog, source = 'shopify_live') {
  if (!env.PRODUCT_CATALOG_KV || !env.PRODUCT_CATALOG_KV.put) return catalog;
  const payload = {
    products: catalog.products || [],
    mode: catalog.mode || source,
    source,
    lastSyncedAt: new Date().toISOString(),
    productCount: (catalog.products || []).length
  };
  await env.PRODUCT_CATALOG_KV.put(PRODUCT_CATALOG_CACHE_KEY, JSON.stringify(payload), { expirationTtl: PRODUCT_CATALOG_CACHE_TTL_SECONDS });
  return payload;
}

async function refreshProductCatalogCache(env, reason = 'scheduled') {
  const live = await fetchLiveProductCatalog(env);
  if (live.mode === 'shopify_live') {
    const cached = await writeCachedProductCatalog(env, live, 'shopify_live');
    return { ...cached, mode: reason === 'manual_refresh' ? 'manual_refresh' : 'scheduled_refresh' };
  }
  return { ...live, mode: live.mode || 'fallback_static_catalog', refreshReason: reason };
}

async function getProductCatalog(env) {
  const cached = await readCachedProductCatalog(env);
  if (cached) return cached;
  try {
    return await refreshProductCatalogCache(env, 'cache_miss');
  } catch (error) {
    return { products: staticCatalogProducts(), mode: 'fallback_static_catalog', source: 'static', error: 'Live product catalog unavailable; static catalog used.' };
  }
}

async function fetchLiveProductCatalog(env) {
  const domain = normalizeStoreDomain(env.SHOPIFY_STORE_DOMAIN || 'nutrapass.club');
  const token = env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || env.SHOPIFY_STOREFRONT_TOKEN;
  const maxProducts = Math.min(Math.max(Number(env.SHOPIFY_PRODUCTS_LIMIT || 5000), 1), 10000);
  const pageSize = Math.min(Math.max(Number(env.SHOPIFY_PRODUCTS_PAGE_SIZE || 100), 1), 100);
  if (!domain || !token) {
    return { products: staticCatalogProducts(), mode: 'fallback_static_catalog', source: 'static', needsSetup: true };
  }
  const query = `query NutraPassProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          title
          handle
          vendor
          productType
          tags
          description
          onlineStoreUrl
          featuredImage { url altText }
          images(first: 1) { edges { node { url altText } } }
          variants(first: 1) { edges { node { price { amount currencyCode } } } }
        }
      }
    }
  }`;
  const products = [];
  let after = null;
  let hasNextPage = true;
  while (hasNextPage && products.length < maxProducts) {
    const first = Math.min(pageSize, maxProducts - products.length);
    const response = await fetch(`https://${domain}/api/2025-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token
      },
      body: JSON.stringify({ query, variables: { first, after } })
    });
    if (!response.ok) throw new Error(`shopify_catalog_error_${response.status}`);
    const data = await response.json();
    const productConnection = data.data?.products;
    if (data.errors?.length) throw new Error('shopify_catalog_graphql_error');
    const pageProducts = (productConnection?.edges || [])
      .map((edge) => normalizeShopifyProduct(edge.node || {}))
      .filter((product) => product.name);
    products.push(...pageProducts);
    hasNextPage = Boolean(productConnection?.pageInfo?.hasNextPage);
    after = productConnection?.pageInfo?.endCursor || null;
    if (!after && hasNextPage) break;
  }
  return products.length
    ? { products, mode: 'shopify_live', source: 'shopify_live', productCount: products.length, maxProducts }
    : { products: staticCatalogProducts(), mode: 'fallback_static_catalog', source: 'static' };
}

const SYSTEM_PROMPT = `You are NutraPass's educational wellness research assistant.

You write concise, practical, consumer-friendly educational wellness responses. Your personality is friendly, upbeat, and reassuring — a calm nutrition research guide with clean botanical / mint / citrus NutraPass energy. Be positive and useful without sounding promotional, childish, or medically certain.
You are not medical advice. You do not diagnose, treat, cure, mitigate, or prevent any disease.
Use structure/function language only: "supports", "may be associated with", "may be influenced by", "compare options".
Do not say supplements relieve, treat, cure, fix, prevent, reverse, or heal any disease or symptom.
Do not invent NutraPass products. Recommend only products supplied in the request or in the approved catalog. Preserve each supplied product's URL when returning products.
Do not invent citations. If a PubMed ID is supplied, you may include it. Otherwise omit citations.
Include food-first and lifestyle-first guidance before supplements.
No-results consistency rule: if the user question is vulgar, abusive, aggressively sexual, cancer/oncology/serious-disease treatment seeking, or clearly unrelated to nutrition/wellness/product research, do not provide ingredient results or related products. Return a concise boundary/referral answer, set "noResults": true, and return empty "ingredientNotes" and "products" arrays.
Privacy/data-collection rule: if the user asks what data NutraPass collects, saves, stores, remembers, knows about them, or asks about privacy/personal information, do not infer or invent stored profile/account data. Rephrase the privacy policy plainly: NutraPass is not collecting, selling, or saving personal data from this tool; NutraPass does not save questions, follow-up questions, or generated reports on its servers; when AI is active, the question and relevant results context are sent securely to the AI provider only to generate the response; users should avoid names, contact details, account numbers, or highly sensitive medical details. Do not say NutraPass stores wellness goals, health overviews, account settings, or personal profiles unless an explicit provided policy says so.
Prioritize clinically backed ingredients first when evidence is reasonably strong for the user's goal. Traditional options and traditional or alternative options are acceptable when relevant, but clearly label them as traditional, emerging, or situation-dependent comparison options rather than presenting them as equally proven.
For the Nutritional Key Points, infer a specific wellness pattern from the user's wording (digestive bloating vs reflux vs constipation vs sleep/stress vs fatigue/iron-status vs immune vs performance vs joint/mobility/connective tissue vs beauty). Explain the most relevant nutrition and routine considerations in plain language. Keep it concise: 3 short sections only — Nutritional Key Points, Food first, Easy things to try. Do not include a separate Nutrition options to compare section; ingredient cards and product links already cover comparisons. Do not use generic filler unless the user gives no usable detail. If the user's wording is vague but includes a real body clue (for example shoulder pain, crunchy joints, soreness, cramps, fatigue, sleep, bloating), choose the closest useful pattern and ask at most one clarifying question inside that specific section instead of punting to broad categories.
For menopause, perimenopause, hot flashes, night sweats, or midlife sleep concerns, include a short Nutritional Key Points section that explains sleep disruption may be influenced by hormonal transition, night sweats/hot flashes, stress load, caffeine/alcohol timing, blood-sugar rhythm, mood changes, and nutrient status. Keep it educational, not diagnostic.
Never tell the user their question does not match a category. Never expose internal routing, category matching, or classification logic. If the user gives no usable wellness detail, ask one short clarifying question instead of producing a broad wellness dump. If the user gives even one clue, choose the closest wellness pattern and write a specific Nutritional Key Points section using plain language. Avoid generic lists such as "meal quality, protein, fiber, hydration, sleep, stress, movement, nutrient gaps" unless those items are directly tied to the user's stated goal.
Include a stronger professional-care note for red flags such as severe pain, swelling, one-sided calf pain, warmth, chest pain, shortness of breath, numbness, sudden weakness, pregnancy/nursing, kidney disease, blood thinners, or persistent/worsening symptoms.
Ingredient Research Notes requirements:
- Return 10–12 ingredient notes whenever enough approved ingredients are supplied.
- Rank notes by likely relevance to the user's wording.
- The first 4–6 notes are shown under the Top Matches section.
- The remaining 4–6 notes are shown under Additional Options to Compare, including secondary or situation-dependent options when appropriate.
- Do not repeat "Top Match" or "Additional Option to Compare" inside each ingredient note's bestFit text; the section heading already carries that ranking.
- Each researchContext should be a 2–3 sentence research context, not a generic one-liner.
- Each note must also include a mechanism field: 1–2 short sentences on the plain-language biological mechanism of action, such as receptor/signaling, nutrient-status, microbiome, barrier, muscle/nerve, antioxidant, or substrate/cofactor pathways. Keep it educational and avoid drug-like or disease-treatment claims.
- Do not imply the user should take every ingredient; frame them as comparison options.
- Ingredient notes must be nutrients, botanicals, compounds, or honest blend categories — not NutraPass product names. For example, Joint Complex is a product/blend category, not an ingredient; if relevant, write about joint-support nutrients such as collagen peptides, omega-3s, turmeric/curcumin, glucosamine/chondroitin/MSM category comparisons, or minerals rather than naming Joint Complex as an ingredient.

Return strict JSON only with this shape:
{
  "summary": "one short paragraph",
  "nutritionOverview": "Nutritional Key Points: 1–2 concise sentences explaining the user's likely wellness pattern without diagnosing.\n\nFood first: 1 concise sentence with the most relevant food/routine basics.\n\nEasy things to try: 1–2 concise sentences with practical next steps and one clarifying question only if needed. Do not include a Nutrition options to compare section.",
  "ingredientNotes": [
    {"name":"Magnesium","bestFit":"Normal muscle function and relaxation-routine support","researchContext":"2–3 sentence research context...","mechanism":"1–2 short sentences on the plain-language biological mechanism of action...","typicalRange":"...","pubmedId":""},
    {"name":"Omega-3s","bestFit":"Secondary inflammatory-balance and heart-health comparison","researchContext":"2–3 sentence research context...","mechanism":"1–2 short sentences on the plain-language biological mechanism of action...","typicalRange":"...","pubmedId":""}
  ],
  "products": [
    {"name":"H2O Electrolytes","brand":"Cellutrex","url":"https://nutrapass.club/products/...","imageUrl":"","why":"..."},
    {"name":"Stress Complex","brand":"Silver Fern","url":"https://nutrapass.club/products/...","imageUrl":"","why":"..."}
  ],
  "noResults": false
}`;

const CLINICAL_LOOKUP_PROMPT = `You are NutraPass's clinical nutrition literature lookup assistant.

The user will provide one vitamin, mineral, herb, amino acid, botanical, or supplement ingredient. Write an educational research summary only. Be friendly, upbeat, and reassuring while staying precise. Do not diagnose, treat, cure, mitigate, prevent, reverse, fix, or heal any disease. Do not recommend that the user take the ingredient. Use language such as "studied for", "researched in", "may be associated with", "compare", and "review safety".

Prioritize clinically backed context first. Traditional or alternative options are acceptable to discuss when clearly labeled as traditional use, emerging evidence, mixed evidence, or situation-dependent. For Black cohosh and similar botanicals, be balanced, not dismissive: mention menopause-related research areas and the mixed evidence picture, then give practical caveats about extract form, liver-related safety review, pregnancy/nursing, medication context, and professional guidance when appropriate.

Return strict JSON only with this shape:
{
  "summary": "one concise paragraph explaining what the ingredient is, what research areas it is commonly studied in, and the most important safety/form/dose caveats",
  "links": [
    {"kind":"Review", "title":"descriptive source/search title", "url":"https://...", "note":"why this source/search is useful"}
  ]
}

Link rules:
- Prefer durable search URLs from PubMed, ClinicalTrials.gov, NIH ODS when appropriate, Google Scholar, and reputable evidence databases.
- Do not invent PubMed IDs or claim a paper exists unless you are giving a search URL.
- It is okay to return zero links because the front-end adds default research searches.
- Keep links to 4–8 maximum.
- Include a safety/interactions search when relevant.`;

const FOLLOW_UP_PROMPT = `You are NutraPass's educational wellness follow-up assistant.

Answer the shopper's follow-up question using the NutraPass results above supplied in the request. Be warm, kind, and helpful — friendly, upbeat, and useful like a calm nutrition guide, not a clinician. Do not replace or rewrite the results above unless directly asked. When referring back to context, use friendly phrases like "the results above," "these matches," or "the ingredient and product matches above." Avoid stiff phrases like "your report" or "the original report."

Keep the answer tight: 55–110 words, 2 short paragraphs max, or 3 short bullets max. Avoid wall-of-text responses, markdown bolding, long numbered lists, and overly medical phrasing. Use plain-language structure/function wording only. Do not diagnose, treat, cure, mitigate, prevent, reverse, fix, or heal any disease or symptom. Do not invent NutraPass products. Use only the products and ingredient notes supplied in the request. Include food-first or practical next-step guidance when useful.
Prioritize clinically backed ingredients first. Traditional or alternative options are fine when they are clearly framed as traditional, emerging, mixed-evidence, or situation-dependent comparison options.

No-results consistency rule: if the shopper's follow-up is vulgar, abusive, aggressively sexual, cancer/oncology/serious-disease treatment seeking, or clearly unrelated to nutrition/wellness/product research, do not provide related products. Return a concise boundary/referral answer, set "noResults": true, use an empty products array, and use an empty gaps array.

Privacy/data-collection rule: if the shopper asks what data NutraPass collects, saves, stores, remembers, knows about them, or asks about privacy/personal information, answer only by rephrasing the privacy policy. Be clear and direct: NutraPass is not collecting, selling, or saving personal data from this tool; NutraPass does not save questions, follow-up questions, or generated reports on its servers; when AI is active, the question and relevant results context are sent securely to the AI provider only to generate the response. Do not say NutraPass stores wellness goals, health overviews, account settings, personal profiles, or knows facts about the shopper. Do not personalize the privacy answer from results context. Return an empty products array and an empty gaps array for privacy/data questions.

If the shopper asks about a product, brand, or supplement that is not in the supplied NutraPass products, do not force a NutraPass product. Give practical quality/clear-label guidance instead: look for a transparent Supplement Facts panel, exact ingredient forms and amounts, third-party testing or cGMP quality cues, minimal proprietary blends, allergen/sweetener clarity, and serving-size math that matches the research context. Return an empty products array unless a supplied product is directly relevant.

Safety notes should be brief and gentle: mention professional care only for red flags, pregnancy/nursing, medications, kidney disease, blood thinners, severe symptoms, or persistent/worsening concerns. If one missing detail would materially improve the answer, ask at most one short gap-filling question in the gaps array. Leave gaps empty when the answer is already clear.
Never tell the shopper their question does not match a category. Never expose internal routing, category matching, or classification logic. If the follow-up gives no usable wellness detail, ask one short clarifying question instead of producing a broad wellness dump. Avoid generic lists such as "meal quality, protein, fiber, hydration, sleep, stress, movement, nutrient gaps" unless those items are directly tied to the shopper's stated goal.

Return strict JSON only with this shape:
{
  "answer": "warm, concise answer in 55-110 words; no markdown bolding; no long numbered lists",
  "gaps": ["optional single concise question to fill an important gap"],
  "products": [
    {"name":"Existing product from supplied results only","brand":"Silver Fern","imageUrl":"","why":"why it remains relevant to this follow-up"}
  ],
  "noResults": false
}`;

function json(data, status = 200, origin = ALLOWED_ORIGINS_DEFAULT[0]) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...privacyHeaders(origin), 'Content-Type': 'application/json' },
  });
}


function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function simpleroWebhookAuthorized(request, env, url) {
  const configured = String(env.SIMPLERO_WEBHOOK_SECRET || '').trim();
  if (!configured) return false;
  const supplied = request.headers.get('X-NutraPass-Webhook-Secret')
    || request.headers.get('X-Webhook-Secret')
    || url.searchParams.get('secret')
    || url.searchParams.get('token')
    || '';
  return timingSafeEqual(supplied, configured);
}

function walkValues(value, visitor, depth = 0) {
  if (depth > 8 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) walkValues(item, visitor, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      visitor(key, item);
      walkValues(item, visitor, depth + 1);
    }
  }
}

function extractSimpleroContact(payload = {}) {
  const contact = { email: '', firstName: '', lastName: '', name: '', tags: [] };
  walkValues(payload, (key, value) => {
    const k = String(key || '').toLowerCase();
    if (!contact.email && typeof value === 'string' && (k === 'email' || k.endsWith('_email')) && /@/.test(value)) contact.email = value.trim().toLowerCase();
    if (!contact.firstName && typeof value === 'string' && ['first_name', 'firstname', 'first name'].includes(k)) contact.firstName = value.trim();
    if (!contact.lastName && typeof value === 'string' && ['last_name', 'lastname', 'last name'].includes(k)) contact.lastName = value.trim();
    if (!contact.name && typeof value === 'string' && k === 'name') contact.name = value.trim();
    if ((k === 'tag' || k === 'tags') && typeof value === 'string') contact.tags.push(value.trim());
    if ((k === 'tag' || k === 'tags') && Array.isArray(value)) contact.tags.push(...value.map((tag) => String(tag || '').trim()).filter(Boolean));
  });
  if ((!contact.firstName || !contact.lastName) && contact.name) {
    const parts = contact.name.split(/\s+/).filter(Boolean);
    if (!contact.firstName) contact.firstName = parts[0] || '';
    if (!contact.lastName) contact.lastName = parts.slice(1).join(' ');
  }
  return contact;
}

function simpleroActionTags(url, payload, contactTags = []) {
  const action = String(url.searchParams.get('action') || payload.action || payload.event || payload.trigger || '').toLowerCase();
  const text = `${action} ${contactTags.join(' ')}`.toLowerCase();
  const tags = ['nutrapass'];
  if (/subscrib|purchase|paid|member|active/.test(text)) tags.push('approved', 'member', 'active', 'paid subscriber');
  else if (/approv/.test(text)) tags.push('approved');
  else if (/appl|lead|submit/.test(text)) tags.push('applicant');
  else tags.push('approved');
  return Array.from(new Set(tags));
}

function normalizeShopifyDomainForAdmin(env) {
  const domain = normalizeStoreDomain(env.SHOPIFY_ADMIN_STORE_DOMAIN || env.SHOPIFY_STORE_DOMAIN || '');
  if (!domain) return '';
  return domain.includes('.myshopify.com') ? domain : domain;
}

function mergeTagString(existing, additions) {
  const tags = String(existing || '').split(',').map((tag) => tag.trim()).filter(Boolean);
  for (const tag of additions) if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  return tags.join(', ');
}

async function shopifyAdminFetch(env, path, init = {}) {
  const domain = normalizeShopifyDomainForAdmin(env);
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!domain || !token) throw new Error('Missing Shopify Admin domain or token');
  const url = `https://${domain}/admin/api/2025-10${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`Shopify Admin API ${response.status}: ${text.slice(0, 400)}`);
  return data;
}

async function findShopifyCustomerByEmail(env, email) {
  const data = await shopifyAdminFetch(env, `/customers/search.json?query=${encodeURIComponent(`email:${email}`)}&limit=1`, { method: 'GET' });
  return Array.isArray(data.customers) && data.customers.length ? data.customers[0] : null;
}

async function upsertShopifyCustomerFromSimplero(env, contact, tagsToAdd) {
  if (!contact.email) return { ok: false, error: 'No email found in Simplero payload' };
  const existing = await findShopifyCustomerByEmail(env, contact.email);
  if (existing && existing.id) {
    const updatedTags = mergeTagString(existing.tags, tagsToAdd);
    await shopifyAdminFetch(env, `/customers/${existing.id}.json`, {
      method: 'PUT',
      body: JSON.stringify({ customer: { id: existing.id, tags: updatedTags, first_name: contact.firstName || existing.first_name || undefined, last_name: contact.lastName || existing.last_name || undefined } })
    });
    return { ok: true, action: 'updated', customerId: existing.id, email: contact.email, tags: updatedTags };
  }
  const created = await shopifyAdminFetch(env, '/customers.json', {
    method: 'POST',
    body: JSON.stringify({ customer: { email: contact.email, first_name: contact.firstName || undefined, last_name: contact.lastName || undefined, tags: tagsToAdd.join(', '), verified_email: true } })
  });
  return { ok: true, action: 'created', customerId: created.customer && created.customer.id, email: contact.email, tags: tagsToAdd.join(', ') };
}

async function handleSimpleroWebhook(request, env, url, allowOrigin) {
  if (!simpleroWebhookAuthorized(request, env, url)) return json({ error: 'Not found' }, 404, allowOrigin);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413, allowOrigin);
  let payload = {};
  try { payload = await request.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400, allowOrigin); }
  const contact = extractSimpleroContact(payload);
  const tagsToAdd = simpleroActionTags(url, payload, contact.tags);
  try {
    const result = await upsertShopifyCustomerFromSimplero(env, contact, tagsToAdd);
    return json({ ok: true, ...result, addedTags: tagsToAdd }, 200, allowOrigin);
  } catch (error) {
    return json({ ok: false, error: 'Shopify update failed', detail: String(error.message || error).slice(0, 500) }, 502, allowOrigin);
  }
}

function healthPage(origin = ALLOWED_ORIGINS_DEFAULT[0]) {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NutraPass AI Worker</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f4fbf6;color:#243028;padding:24px}
    main{max-width:680px;background:white;border:1px solid #cfead8;border-radius:22px;padding:28px;box-shadow:0 18px 55px rgba(45,92,59,.12)}
    h1{margin:0 0 10px;color:#2f7f50} code{background:#eef8f1;padding:.12rem .35rem;border-radius:6px}
    p{line-height:1.55}.ok{display:inline-block;background:#e7f7ec;color:#2f7f50;border-radius:999px;padding:6px 10px;font-weight:700;font-size:.86rem}
  </style>
</head>
<body>
  <main>
    <span class="ok">Deployed</span>
    <h1>NutraPass AI Worker</h1>
    <p>This endpoint is live. It is an API endpoint for the NutraPass widget, so normal browser visits show this status page.</p>
    <p>The widget should call this endpoint with a <code>POST</code> request containing JSON such as <code>{"goal":"..."}</code>.</p>
    <p>Current AI mode depends on configured provider secrets such as <code>OPENAI_API_KEY</code> and <code>ANTHROPIC_API_KEY</code>. Without a usable provider key, the Worker uses the static educational fallback.</p>
  </main>
</body>
</html>`, {
    status: 200,
    headers: { ...privacyHeaders(origin), 'Content-Type': 'text/html; charset=UTF-8' },
  });
}

async function verifyTurnstile(env, token, remoteIp) {
  if (!env.TURNSTILE_SECRET_KEY) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: 'Missing Turnstile token' };
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', String(token));
  if (remoteIp) form.append('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const result = await response.json().catch(() => ({}));
  return { ok: Boolean(result.success), error: 'Turnstile verification failed' };
}

function safeParseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

function productNameKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function enrichProductLinks(parsed, suppliedProducts = []) {
  if (!parsed || !Array.isArray(parsed.products)) return parsed;
  const catalog = Array.isArray(suppliedProducts) ? suppliedProducts : [];
  parsed.products = parsed.products.map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (item.url || item.u) return item;
    const itemKey = productNameKey(item.name || item.n);
    const match = catalog.find((p) => {
      const catalogKey = productNameKey(p.name || p.n);
      return catalogKey && itemKey && (catalogKey === itemKey || catalogKey.includes(itemKey) || itemKey.includes(catalogKey));
    });
    if (!match) return item;
    return {
      ...item,
      url: match.url || match.u || '',
      u: match.u || match.url || '',
      price: item.price || item.p || match.price || match.p || '',
      p: item.p || item.price || match.p || match.price || '',
      brand: item.brand || match.brand || '',
      imageUrl: item.imageUrl || item.img || match.imageUrl || match.img || '',
      img: item.img || item.imageUrl || match.img || match.imageUrl || ''
    };
  });
  return parsed;
}

function textTokens(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function classifyCommonIntent(userText) {
  const text = ` ${String(userText || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  let best = { intent: 'other', score: 0 };
  for (const intent of COMMON_INTENT_KEYS) {
    const score = COMMON_INTENT_RESPONSES[intent].keywords.reduce((sum, keyword) => {
      const normalized = String(keyword).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return text.includes(` ${normalized} `) ? sum + Math.max(1, normalized.split(/\s+/).length) : sum;
    }, 0);
    if (score > best.score) best = { intent, score };
  }
  return best.score ? best.intent : 'other';
}

function hasNuancedContext(userText) {
  const text = String(userText || '').toLowerCase();
  return text.length > 220
    || (/\b(ice|dirt|clay|chalk|laundry starch|cornstarch|pica)\b/.test(text) && /\b(crav|chew|eat|mouth|gnaw)\w*/.test(text))
    || /\b(menopause|perimenopause|hot flash|hot flashes|night sweat|night sweats|midlife)\b/.test(text)
    || /\b(pregnant|nursing|breastfeeding|child|kidney|liver|heart disease|cancer|diabetes|blood pressure|warfarin|ssri|maoi|medication|diagnosed|doctor|clinician|surgery|allergy|allergic)\b/.test(text);
}

function shouldUseCommonFastPath(body, userText) {
  if (body && body.forceAi === true) return false;
  const intent = classifyCommonIntent(userText);
  return intent !== 'other' && !hasNuancedContext(userText);
}

function commonResponseKey(intent) {
  return `${COMMON_RESPONSE_CACHE_PREFIX}${intent}`;
}

async function readCommonResponseCache(env, intent) {
  if (!env.PRODUCT_CATALOG_KV || !env.PRODUCT_CATALOG_KV.get) return null;
  const cached = await env.PRODUCT_CATALOG_KV.get(commonResponseKey(intent), 'json');
  if (!cached || cached.intent !== intent) return null;
  return cached;
}

async function writeCommonResponseCache(env, intent, response) {
  if (!env.PRODUCT_CATALOG_KV || !env.PRODUCT_CATALOG_KV.put) return response;
  const payload = { ...response, intent, cachedAt: new Date().toISOString() };
  await env.PRODUCT_CATALOG_KV.put(commonResponseKey(intent), JSON.stringify(payload), { expirationTtl: COMMON_RESPONSE_CACHE_TTL_SECONDS });
  return payload;
}

function scoreCommonIntentProduct(intent, product = {}) {
  const text = ` ${[product.name, product.n, product.brand, product.why, product.w, product.productType, product.category].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  if (intent !== 'immune') return 0;
  if (/\b(conditioner|shampoo|sun balm|sunscreen|soap|lotion|body essentials|topical|tallow balm|skin balm|hair complex|hair skin nails|keratin)\b/.test(text)) return -1000;
  let score = 0;
  [
    ['immune', 80], ['immunity', 80], ['probiotic', 65], ['prebiotic', 60], ['postbiotic', 70], ['biotic', 45],
    ['microbiome', 35], ['gut repair', 45], ['gut and immune', 80], ['multivitamin', 45], ['daily essential vitamin', 50],
    ['vitamin d', 40], ['d3', 35], ['k2 d3', 35], ['glutamine', 30], ['trace mineral', 25]
  ].forEach(([term, weight]) => { if (text.includes(` ${term} `) || text.includes(term)) score += weight; });
  return score;
}

function prioritizeCommonIntentProducts(intent, products = []) {
  if (intent !== 'immune') return products;
  return (products || [])
    .map((product, index) => ({ product, index, score: scoreCommonIntentProduct(intent, product) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.product);
}

function buildCommonIntentResponse(intent, products = []) {
  const template = COMMON_INTENT_RESPONSES[intent] || COMMON_INTENT_RESPONSES.gut_health;
  const rankedProducts = prioritizeCommonIntentProducts(intent, products);
  const productCards = (rankedProducts.length ? rankedProducts : products || []).slice(0, 6).map((p) => ({
    name: p.name || p.n || '',
    brand: p.brand || '',
    price: p.price || p.p || '',
    url: p.url || p.u || '',
    u: p.u || p.url || '',
    imageUrl: p.imageUrl || p.img || '',
    img: p.img || p.imageUrl || '',
    why: p.why || p.w || 'Relevant NutraPass product to compare for this educational goal.'
  }));
  const ingredientTemplates = {
    immune: [
      { name: 'Vitamin D3', bestFit: 'Nutrient-status and normal immune-function support', researchContext: 'Vitamin D is commonly researched for immune and bone-health support; blood levels, sun exposure, diet, and dose all affect fit.', typicalRange: 'Common supplemental range: 1,000–2,000 IU/day; blood levels and professional guidance matter.', pubmedId: '32252338' },
      { name: 'Vitamin C', bestFit: 'Food-first antioxidant and immune nutrient support', researchContext: 'Vitamin C supports normal immune function and collagen biology; food sources are a practical first step before stacking high-dose products.', typicalRange: 'Food-first sources include citrus, berries, kiwi, peppers, broccoli, and potatoes.', pubmedId: '29099763' },
      { name: 'Zinc', bestFit: 'Normal immune-function and barrier-support nutrient', researchContext: 'Zinc supports normal immune function, but dose and duration matter because long-term high zinc can affect copper status.', typicalRange: 'Common range: 10–30 mg/day elemental zinc; avoid chronic high-dose use without guidance.', pubmedId: '31305906' },
      { name: 'Probiotics', bestFit: 'Gut-immune microbiome comparison', researchContext: 'Microbiome balance and immune signaling overlap, so probiotic strain, CFU count, and use-case are important comparison points.', typicalRange: 'Label ranges vary by strain and purpose; compare strain IDs, CFU through expiration, and storage directions.', pubmedId: '35945628' },
      { name: 'Butyrate / postbiotics', bestFit: 'Gut-barrier and postbiotic immune-support comparison', researchContext: 'Postbiotic and butyrate-support categories are often compared for gut-barrier and microbiome signaling support.', typicalRange: 'Follow label directions; compare form, dose, and whether the product is paired with prebiotic/probiotic support.', pubmedId: '32828753' },
      { name: 'Prebiotic fiber', bestFit: 'Microbiome-feeding foundation option', researchContext: 'Prebiotic fibers help feed beneficial microbes and can support regularity; increase slowly because tolerance differs.', typicalRange: 'Start low, often 2–5 g/day, and increase gradually with fluids as tolerated.', pubmedId: '29606185' },
      { name: 'Selenium', bestFit: 'Antioxidant and immune nutrient-status comparison', researchContext: 'Selenium supports antioxidant enzyme systems and normal immune function, but the safe range is narrower than many vitamins.', typicalRange: 'Often covered by food or multis; avoid stacking high-dose selenium products.', pubmedId: '30509983' },
      { name: 'Multivitamin support', bestFit: 'Foundation coverage when diet gaps are likely', researchContext: 'A broad multi can be a comparison option when vitamin/mineral coverage is inconsistent, but it should not duplicate high-dose single nutrients.', typicalRange: 'Follow label directions and check overlap with D, zinc, selenium, and other immune formulas.', pubmedId: '' }
    ]
  };
  const ingredientNotes = (ingredientTemplates[intent] || template.ingredients.map((name) => ({
    name,
    bestFit: ingredientNutritionRole(name),
    researchContext: ingredientNutritionSummary(name),
    typicalRange: ingredientTypicalRange(name),
    pubmedId: ''
  }))).map((note) => ({ ...note, mechanism: note.mechanism || ingredientMechanism(note.name) }));
  return {
    summary: template.summary,
    nutritionOverview: template.overview,
    ingredientNotes,
    products: productCards,
    followUpQuestions: template.followUps,
    type: 'common_intent',
    intent
  };
}

function updateAverage(existingAverage, existingCount, nextValue) {
  const count = Number(existingCount || 0);
  const avg = Number(existingAverage || 0);
  return Math.round(((avg * count) + Number(nextValue || 0)) / (count + 1));
}

async function recordQuestionAnalytics(env, event = {}) {
  if (!env.PRODUCT_CATALOG_KV || !env.PRODUCT_CATALOG_KV.get || !env.PRODUCT_CATALOG_KV.put) return;
  const intent = COMMON_INTENT_KEYS.includes(event.intent) ? event.intent : 'other';
  const key = `${QUESTION_ANALYTICS_PREFIX}${intent}`;
  const now = new Date().toISOString();
  const existing = await env.PRODUCT_CATALOG_KV.get(key, 'json') || {};
  const count = Number(existing.count || 0) + 1;
  const cacheHits = Number(existing.cacheHits || 0) + (event.cacheHit ? 1 : 0);
  const aiUses = Number(existing.aiUses || 0) + (event.aiUsed ? 1 : 0);
  const payload = {
    intent,
    count,
    cacheHits,
    aiUses,
    firstSeenAt: existing.firstSeenAt || now,
    lastSeenAt: now,
    avgResponseMs: updateAverage(existing.avgResponseMs, existing.count, event.responseMs || 0)
  };
  await env.PRODUCT_CATALOG_KV.put(key, JSON.stringify(payload));
}

function dailyKey(date = new Date()) {
  return `${DAILY_ANALYTICS_PREFIX}${date.toISOString().slice(0, 10)}`;
}

function emptyDailyAnalytics(day) {
  return {
    day,
    totalUses: 0,
    researchSearches: 0,
    followupQuestions: 0,
    clinicalLookups: 0,
    aiUses: 0,
    cacheHits: 0,
    errors: 0,
    avgResponseMs: 0,
    intents: {}
  };
}

function normalizeAnalyticsKind(kind) {
  if (kind === 'followup' || kind === 'clinical') return kind;
  return 'research';
}

async function recordDailyAnalytics(env, event = {}) {
  if (!env.PRODUCT_CATALOG_KV || !env.PRODUCT_CATALOG_KV.get || !env.PRODUCT_CATALOG_KV.put) return;
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const key = dailyKey(now);
  const existing = await env.PRODUCT_CATALOG_KV.get(key, 'json') || emptyDailyAnalytics(day);
  const kind = normalizeAnalyticsKind(event.kind);
  const intent = COMMON_INTENT_KEYS.includes(event.intent) ? event.intent : 'other';
  const totalUses = Number(existing.totalUses || 0) + 1;
  const payload = {
    ...emptyDailyAnalytics(day),
    ...existing,
    day,
    totalUses,
    researchSearches: Number(existing.researchSearches || 0) + (kind === 'research' ? 1 : 0),
    followupQuestions: Number(existing.followupQuestions || 0) + (kind === 'followup' ? 1 : 0),
    clinicalLookups: Number(existing.clinicalLookups || 0) + (kind === 'clinical' ? 1 : 0),
    aiUses: Number(existing.aiUses || 0) + (event.aiUsed ? 1 : 0),
    cacheHits: Number(existing.cacheHits || 0) + (event.cacheHit ? 1 : 0),
    errors: Number(existing.errors || 0) + (event.error ? 1 : 0),
    avgResponseMs: updateAverage(existing.avgResponseMs, existing.totalUses, event.responseMs || 0),
    intents: {
      ...(existing.intents || {}),
      [intent]: Number((existing.intents || {})[intent] || 0) + 1
    },
    lastSeenAt: now.toISOString()
  };
  await env.PRODUCT_CATALOG_KV.put(key, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 120 });
}

function rollupDailyAnalytics(days = []) {
  const summary = emptyDailyAnalytics('rollup');
  for (const day of days) {
    if (!day) continue;
    const countBefore = summary.totalUses;
    summary.totalUses += Number(day.totalUses || 0);
    summary.researchSearches += Number(day.researchSearches || 0);
    summary.followupQuestions += Number(day.followupQuestions || 0);
    summary.clinicalLookups += Number(day.clinicalLookups || 0);
    summary.aiUses += Number(day.aiUses || 0);
    summary.cacheHits += Number(day.cacheHits || 0);
    summary.errors += Number(day.errors || 0);
    summary.avgResponseMs = summary.totalUses
      ? Math.round(((summary.avgResponseMs * countBefore) + (Number(day.avgResponseMs || 0) * Number(day.totalUses || 0))) / summary.totalUses)
      : 0;
    for (const [intent, count] of Object.entries(day.intents || {})) {
      summary.intents[intent] = Number(summary.intents[intent] || 0) + Number(count || 0);
    }
  }
  return summary;
}

async function getDailyAnalyticsSummary(env) {
  if (!env.PRODUCT_CATALOG_KV || !env.PRODUCT_CATALOG_KV.get) return { mode: 'daily_analytics_unavailable' };
  const today = new Date();
  const days = [];
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(today.getTime() - (i * 86400000));
    const day = date.toISOString().slice(0, 10);
    const row = await env.PRODUCT_CATALOG_KV.get(dailyKey(date), 'json');
    days.push(row || emptyDailyAnalytics(day));
  }
  return {
    mode: 'dailyAnalytics',
    storesRawQuestions: false,
    today: days[0],
    last7Days: rollupDailyAnalytics(days.slice(0, 7)),
    last30Days: rollupDailyAnalytics(days),
    days
  };
}

function trackDaily(ctx, env, event = {}) {
  if (ctx && ctx.waitUntil) ctx.waitUntil(recordDailyAnalytics(env, event));
}

async function getQuestionAnalyticsSummary(env) {
  if (!env.PRODUCT_CATALOG_KV || !env.PRODUCT_CATALOG_KV.list || !env.PRODUCT_CATALOG_KV.get) {
    return { intents: [], dailyAnalytics: await getDailyAnalyticsSummary(env), mode: 'analytics_unavailable' };
  }
  const listed = await env.PRODUCT_CATALOG_KV.list({ prefix: QUESTION_ANALYTICS_PREFIX, limit: 100 });
  const rows = [];
  for (const item of listed.keys || []) {
    const row = await env.PRODUCT_CATALOG_KV.get(item.name, 'json');
    if (!row || !row.intent) continue;
    const first = row.firstSeenAt ? Date.parse(row.firstSeenAt) : 0;
    const last = row.lastSeenAt ? Date.parse(row.lastSeenAt) : first;
    rows.push({
      intent: row.intent,
      count: Number(row.count || 0),
      firstSeenAt: row.firstSeenAt || null,
      lastSeenAt: row.lastSeenAt || null,
      activeDays: first && last ? Math.max(1, Math.ceil((last - first + 1) / 86400000)) : 0,
      avgResponseMs: Number(row.avgResponseMs || 0),
      cacheHits: Number(row.cacheHits || 0),
      aiUses: Number(row.aiUses || 0)
    });
  }
  rows.sort((a, b) => b.count - a.count || a.intent.localeCompare(b.intent));
  return { mode: 'privacy_safe_question_analytics', storesRawQuestions: false, dailyAnalytics: await getDailyAnalyticsSummary(env), intents: rows };
}

function canReadAnalytics(request, env) {
  const token = env && env.ANALYTICS_READ_TOKEN ? String(env.ANALYTICS_READ_TOKEN) : '';
  if (!token) return false;
  const supplied = request.headers.get('X-NutraPass-Analytics-Token') || new URL(request.url).searchParams.get('token') || '';
  return supplied === token;
}

function ingredientNutritionRole(name = '') {
  const lower = String(name || '').toLowerCase();
  if (/magnesium/.test(lower)) return 'Nutritional overview: mineral support for normal muscle, nerve, energy, and relaxation routines';
  if (/probiotic|biotic/.test(lower)) return 'Nutritional overview: microbiome support for digestive, barrier, and gut-immune routines';
  if (/prebiotic|fiber|inulin|phgg|resistant starch/.test(lower)) return 'Nutritional overview: fermentable fiber support for beneficial gut microbes and regularity';
  if (/vitamin\s*d|d3/.test(lower)) return 'Nutritional overview: nutrient-status support for bone, muscle, and normal immune function';
  if (/vitamin\s*c|ascorb/.test(lower)) return 'Nutritional overview: antioxidant and collagen-cofactor support from a food-first nutrient';
  if (/zinc/.test(lower)) return 'Nutritional overview: mineral support for immune, skin/barrier, and antioxidant systems';
  if (/omega|fish oil|epa|dha/.test(lower)) return 'Nutritional overview: essential fatty acid support for inflammatory-balance and heart-health routines';
  if (/ashwagandha/.test(lower)) return 'Nutritional overview: botanical stress-resilience comparison with safety context';
  if (/theanine/.test(lower)) return 'Nutritional overview: amino-acid support for calm focus and wind-down routines';
  if (/collagen/.test(lower)) return 'Nutritional overview: protein-peptide support for connective tissue, skin, and joint routines';
  if (/creatine/.test(lower)) return 'Nutritional overview: performance nutrient support for strength, power, and training recovery';
  if (/electrolyte|sodium|potassium/.test(lower)) return 'Nutritional overview: mineral support for hydration, sweating, and muscle function';
  if (/selenium/.test(lower)) return 'Nutritional overview: trace-mineral support for antioxidant enzyme and thyroid-related nutrition';
  if (/multivitamin/.test(lower)) return 'Nutritional overview: broad micronutrient coverage when diet gaps are likely';
  return 'Nutritional overview: ingredient-specific nutrition support to compare for this goal';
}

function ingredientNutritionSummary(name = '') {
  const lower = String(name || '').toLowerCase();
  if (/magnesium/.test(lower)) return 'Magnesium is an essential mineral involved in hundreds of enzyme systems, including normal muscle contraction, nerve signaling, and cellular energy production. It can be nutritionally relevant when sleep quality, muscle tension, activity level, or intake of magnesium-rich foods is part of the picture.';
  if (/probiotic|biotic/.test(lower)) return 'Probiotics are live microbes used to compare microbiome-support routines. Nutritional usefulness depends on the strain, dose, and whether the goal is digestive comfort, regularity, or gut-immune support.';
  if (/prebiotic|fiber|inulin|phgg|resistant starch/.test(lower)) return 'Prebiotic fibers help feed beneficial gut bacteria and can support regularity and microbiome diversity. They are usually most useful when increased gradually alongside fluids and tolerated whole-food fiber.';
  if (/vitamin\s*d|d3/.test(lower)) return 'Vitamin D is a fat-soluble nutrient tied to bone, muscle, and normal immune-function nutrition. Blood level, sun exposure, diet, and dose all affect whether it is a meaningful comparison point.';
  if (/vitamin\s*c|ascorb/.test(lower)) return 'Vitamin C supports antioxidant status, collagen formation, and normal immune function. Citrus, berries, kiwi, peppers, and broccoli are practical food-first sources before comparing higher-dose supplements.';
  if (/zinc/.test(lower)) return 'Zinc is a trace mineral used in immune, skin/barrier, and antioxidant enzyme biology. It is worth comparing carefully because long-term high intake can affect copper balance.';
  if (/omega|fish oil|epa|dha/.test(lower)) return 'Omega-3s are essential fats commonly compared for heart-health, brain-health, and inflammatory-balance routines. Food sources like fatty fish are useful context when judging whether a product adds value.';
  if (/ashwagandha/.test(lower)) return 'Ashwagandha is a botanical often compared for stress and sleep-quality routines. It is not a basic nutrient, so extract quality, dose, thyroid/autoimmune context, pregnancy, and medications matter.';
  if (/theanine/.test(lower)) return 'L-theanine is an amino acid from tea commonly compared for calm-focus and evening wind-down routines. It can fit when the goal is relaxation without heavy sedation.';
  if (/collagen/.test(lower)) return 'Collagen peptides provide amino-acid building blocks used in connective-tissue proteins. They are usually compared alongside total protein intake and vitamin C-rich foods.';
  if (/creatine/.test(lower)) return 'Creatine is a well-studied performance nutrient for strength, power, and high-intensity training support. It is usually evaluated by form, daily amount, consistency, and hydration tolerance.';
  if (/electrolyte|sodium|potassium/.test(lower)) return 'Electrolytes support hydration balance and normal nerve/muscle function. They are most nutritionally relevant around sweating, heat, travel, low-carb eating, or longer activity.';
  if (/selenium/.test(lower)) return 'Selenium is a trace mineral involved in antioxidant enzyme systems. It has a narrow useful range, so total intake from food, multis, and immune formulas should be compared before stacking.';
  if (/multivitamin/.test(lower)) return 'A multivitamin can provide broad micronutrient coverage when diet variety is inconsistent. It should be checked for overlap with separate vitamin D, zinc, selenium, or immune formulas.';
  return 'This ingredient is included as a nutrition-focused comparison option for the stated goal. Compare food sources, ingredient form, serving amount, product quality, and personal context before deciding whether it belongs in a routine.';
}

function ingredientTypicalRange(name = '') {
  const lower = String(name || '').toLowerCase();
  if (/magnesium/.test(lower)) return 'Common supplemental range: 100–300 mg elemental magnesium/day, depending on form and tolerance.';
  if (/vitamin\s*d|d3/.test(lower)) return 'Common supplemental range: 1,000–2,000 IU/day; blood levels help guide fit.';
  if (/zinc/.test(lower)) return 'Common range: 10–30 mg/day elemental zinc; avoid chronic high-dose stacking without guidance.';
  if (/creatine/.test(lower)) return 'Common range: 3–5 g/day creatine monohydrate.';
  if (/theanine/.test(lower)) return 'Common range: 100–200 mg as needed in research and product labels.';
  if (/fiber|prebiotic/.test(lower)) return 'Start low, often 2–5 g/day, and increase gradually with fluids as tolerated.';
  return '';
}

function ingredientMechanism(name = '') {
  const lower = String(name || '').toLowerCase();
  if (/probiotic|biotic/.test(lower)) return 'Probiotics work through strain-specific microbiome signaling, short-chain fatty acid production, and gut-barrier interactions. Their effects depend heavily on strain, dose, and the person’s baseline microbiome.';
  if (/prebiotic|fiber|inulin|phgg|resistant starch/.test(lower)) return 'Prebiotic fibers act as fermentable substrates for beneficial gut microbes, which can increase short-chain fatty acid production. This can influence stool form, gut-barrier function, and microbiome signaling.';
  if (/vitamin\s*d|d3/.test(lower)) return 'Vitamin D acts through the vitamin D receptor, which helps regulate calcium balance and immune-cell signaling. Status matters because low baseline levels and dose both change the expected response.';
  if (/vitamin\s*c|ascorb/.test(lower)) return 'Vitamin C functions as a water-soluble antioxidant and cofactor for collagen synthesis. It also supports normal immune-cell function and helps regenerate other antioxidants.';
  if (/zinc/.test(lower)) return 'Zinc is a cofactor for many enzymes and transcription factors involved in immune-cell development, skin/barrier integrity, and antioxidant defense. Too much zinc can compete with copper, so dose and duration matter.';
  if (/magnesium/.test(lower)) return 'Magnesium acts as a cofactor in ATP-dependent enzymes and helps regulate normal nerve and muscle signaling. Different forms can emphasize tolerability, bowel effects, or relaxation-oriented use.';
  if (/omega|fish oil|epa|dha/.test(lower)) return 'Omega-3 fatty acids can be incorporated into cell membranes and influence eicosanoid and resolvin signaling. This is why they are often discussed around inflammatory balance and cardiometabolic support.';
  if (/ashwagandha/.test(lower)) return 'Ashwagandha is studied as an adaptogenic botanical that may influence stress-response signaling, including HPA-axis related pathways. Extract standardization and personal context matter for safety and fit.';
  if (/theanine/.test(lower)) return 'L-theanine may influence glutamate/GABA balance and alpha-wave activity associated with relaxed attention. It is usually framed as calm-focus support rather than a sedative.';
  if (/collagen/.test(lower)) return 'Collagen peptides supply amino acids such as glycine, proline, and hydroxyproline that serve as building blocks for connective-tissue proteins. They may also act as signaling peptides in skin and joint-support research.';
  if (/creatine/.test(lower)) return 'Creatine supports the phosphocreatine system, which helps rapidly regenerate ATP during high-intensity muscle and brain energy demand. Saturating muscle creatine stores is the usual research model.';
  if (/electrolyte|sodium|potassium/.test(lower)) return 'Electrolytes help maintain fluid balance, nerve conduction, and muscle contraction. Needs rise with sweating, heat, travel, low-carb diets, or high activity.';
  if (/melatonin/.test(lower)) return 'Melatonin is a hormone-like signal involved in circadian timing. It is best understood as a sleep-timing cue rather than a general relaxation nutrient.';
  if (/glycine/.test(lower)) return 'Glycine is an amino acid involved in inhibitory neurotransmission, collagen structure, and one-carbon metabolism. Sleep research often focuses on bedtime use and thermoregulation-related pathways.';
  if (/curcumin|turmeric/.test(lower)) return 'Curcumin interacts with inflammatory-signaling pathways in lab and clinical research, but absorption is a key limitation. Formulation quality strongly affects how much reaches circulation.';
  if (/glucosamine|chondroitin|msm/.test(lower)) return 'These joint-support compounds are discussed as structural substrates or sulfur-containing support for cartilage and connective-tissue matrices. Evidence is mixed and product form matters.';
  if (/selenium/.test(lower)) return 'Selenium is built into selenoproteins that support antioxidant enzyme systems and thyroid hormone metabolism. It has a narrow useful range, so more is not automatically better.';
  if (/iron/.test(lower)) return 'Iron is required for hemoglobin, myoglobin, and oxygen-transport biology. Because excess iron can be harmful, iron-status questions are best guided by labs such as CBC, ferritin, and iron studies.';
  if (/b12|cobalamin/.test(lower)) return 'Vitamin B12 supports methylation, nerve function, and red-blood-cell formation. Absorption depends on stomach acid, intrinsic factor, medications, diet pattern, and gut health.';
  if (/ginger/.test(lower)) return 'Ginger contains pungent compounds such as gingerols and shogaols that interact with digestive and sensory signaling pathways. It is usually framed around digestive comfort and nausea research rather than disease treatment.';
  if (/peppermint/.test(lower)) return 'Peppermint oil contains menthol, which can affect smooth-muscle calcium channels and gut sensory signaling. It may not fit reflux-prone users because it can relax the lower esophageal sphincter.';
  return 'This ingredient is included as an educational comparison point based on nutrient-status, signaling, substrate, microbiome, or barrier-support biology. Exact mechanism depends on ingredient form, dose, and personal context.';
}

function staticFallback(goal, products = [], ingredients = []) {
  const g = String(goal || '').toLowerCase();
  const has = (re) => re.test(g);
  const pica = has(/\b(ice|dirt|clay|chalk|laundry starch|cornstarch|pica)\b/) && has(/\b(crav|chew|eat|mouth|gnaw)\w*/);
  const reflux = has(/reflux|acid|heartburn|gerd|burning|indigestion|burp/);
  const bloat = has(/bloat|bloated|gas|fodmap|ibs|distend/);
  const constipation = has(/constipat|regularity|bowel|motility|poop|stool/);
  const menopauseSleep = has(/menopause|perimenopause|hot flash|hot flashes|night sweat|midlife/) && has(/sleep|insomnia|night|tired|fatigue|wake|waking/);
  const sleepStress = has(/sleep|insomnia|stress|anxiety|burnout|worry|cortisol|tired|fatigue/);
  const immune = has(/immune|cold|flu|sick|sinus|seasonal/);
  const performance = !pica && has(/strength|muscle|body|composition|weight|metabolism|workout|cramp|calf|sore|recovery|leg/);
  const jointMobility = has(/shoulder|joint|joints|crunchy|click|clicking|pop|popping|grind|grinding|mobility|stiff|stiffness|tendon|ligament|cartilage|rotator|elbow|knee|hip|neck|back|pain|ache|aches|sore|soreness/);
  const beauty = has(/hair|skin|nail|beauty|collagen|acne|dry skin/);

  const ingredientPool = {
    pica: [
      { name: 'Iron', bestFit: 'Iron-status and ferritin lab follow-up discussion', researchContext: 'Cravings to chew ice or non-food items are commonly discussed in relation to iron status, but only blood work and a qualified clinician can assess what is actually going on.', typicalRange: 'Do not self-dose high iron without labs/professional guidance; iron needs vary and excess iron can be unsafe.', pubmedId: '' },
      { name: 'Vitamin C', bestFit: 'Food-first iron absorption support', researchContext: 'Vitamin C-rich foods can support non-heme iron absorption when paired with iron-containing meals.', typicalRange: 'Food-first examples include citrus, berries, kiwi, bell pepper, and broccoli with iron-containing meals.', pubmedId: '' },
      { name: 'Vitamin B12', bestFit: 'Energy and red-blood-cell nutrient status comparison', researchContext: 'B12 status is often discussed when fatigue, vegan/vegetarian diets, nerve symptoms, or anemia questions are present.', typicalRange: 'Dose and form depend on diet pattern, labs, and clinician guidance.', pubmedId: '' },
      { name: 'Magnesium', bestFit: 'Restless-leg and normal muscle relaxation comparison', researchContext: 'Magnesium is commonly compared for normal muscle and relaxation routines, but restless legs can have multiple contributors and deserves professional follow-up if persistent.', typicalRange: 'Common supplemental range: 100–400 mg/day elemental magnesium, depending on form and tolerance.', pubmedId: '35184264' }
    ],
    reflux: [
      { name: 'Digestive enzymes', bestFit: 'Meal-time digestive support comparison', researchContext: 'Enzymes are often compared when heavier meals or specific foods seem to trigger post-meal discomfort.', typicalRange: 'Typical use: 1 serving with meals, following label directions.', pubmedId: '33141923' },
      { name: 'Ginger', bestFit: 'Occasional digestive comfort comparison', researchContext: 'Ginger is researched for digestive comfort and occasional nausea, though it may not fit every reflux pattern.', typicalRange: 'Common supplemental range: 500–1,500 mg/day depending on form and tolerance.', pubmedId: '25872115' },
      { name: 'Prebiotic fiber', bestFit: 'Gut routine and regularity support', researchContext: 'Gentle fiber may support bowel pattern and microbiome routines, but should be increased slowly if gas is an issue.', typicalRange: 'Start low, often 2–5 g/day, and increase gradually as tolerated.', pubmedId: '29606185' }
    ],
    bloat: [
      { name: 'Digestive enzymes', bestFit: 'Food-trigger and meal-time support comparison', researchContext: 'Enzymes may be compared when bloating tracks with specific meals, proteins, fats, carbs, lactose, or beans/crucifers.', typicalRange: 'Follow product directions with meals.', pubmedId: '33141923' },
      { name: 'Probiotics', bestFit: 'Microbiome balance comparison', researchContext: 'Probiotics are researched for microbiome balance and digestive comfort; strain and use-case matter.', typicalRange: 'Typical label range: 1–10+ billion CFU/day, depending on strain and purpose.', pubmedId: '35945628' },
      { name: 'Prebiotic fiber', bestFit: 'Gentle regularity and microbiome feeding', researchContext: 'Prebiotic fibers can help microbiome and regularity routines, but some fibers can worsen gas if introduced too quickly.', typicalRange: 'Start low and increase gradually.', pubmedId: '29606185' },
      { name: 'Peppermint oil', bestFit: 'Digestive-comfort comparison when reflux is not present', researchContext: 'Peppermint oil is often discussed for digestive comfort, but it can aggravate reflux in some people.', typicalRange: 'Use only as directed; avoid if reflux/heartburn worsens.', pubmedId: '' }
    ],
    constipation: [
      { name: 'Prebiotic fiber', bestFit: 'Regularity and microbiome support', researchContext: 'Soluble fibers can support stool form and regularity routines, especially when increased with fluids.', typicalRange: 'Start with 2–5 g/day and increase gradually as tolerated.', pubmedId: '29606185' },
      { name: 'Magnesium', bestFit: 'Normal muscle and regularity comparison', researchContext: 'Some magnesium forms are commonly compared for bowel regularity and relaxation routines; tolerance differs by form.', typicalRange: 'Common supplemental range: 100–400 mg/day elemental magnesium depending on form and tolerance.', pubmedId: '35184264' },
      { name: 'Probiotics', bestFit: 'Microbiome and bowel pattern support', researchContext: 'Probiotics are researched for microbiome balance and may be compared in regularity routines.', typicalRange: 'Typical label range varies by strain and purpose.', pubmedId: '35945628' }
    ],
    sleepStress: [
      { name: 'Magnesium', bestFit: 'Relaxation and sleep-routine support', researchContext: 'Magnesium is researched for normal nerve/muscle function and relaxation routines; form and tolerance matter.', typicalRange: 'Common supplemental range: 100–400 mg/day elemental magnesium.', pubmedId: '35184264' },
      { name: 'L-theanine', bestFit: 'Calm focus and wind-down support', researchContext: 'L-theanine is researched for calm focus and relaxation without heavy sedation.', typicalRange: 'Common range: 100–200 mg as needed or daily depending on product directions.', pubmedId: '31751906' },
      { name: 'Ashwagandha', bestFit: 'Stress-resilience comparison', researchContext: 'Ashwagandha is researched for perceived stress and sleep quality, but it is not appropriate for everyone.', typicalRange: 'Common extract range: 300–600 mg/day; use caution with thyroid, pregnancy/nursing, autoimmune issues, or medications.', pubmedId: '31517876' },
      { name: 'Melatonin', bestFit: 'Sleep timing and circadian-rhythm support', researchContext: 'Melatonin is best framed around sleep timing rather than general sedation.', typicalRange: 'Use the lowest effective label dose and avoid mixing with sedatives without professional guidance.', pubmedId: '' }
    ],
    menopauseSleep: [
      { name: 'Magnesium', bestFit: 'Clinically backed relaxation-routine and normal muscle/nerve support', researchContext: 'Magnesium is researched for normal nerve and muscle function and is often compared in sleep and relaxation routines. For menopause-related sleep questions, it is a practical first comparison because form, dose, and digestive tolerance can be checked clearly on labels.', typicalRange: 'Common supplemental range: 100–400 mg/day elemental magnesium depending on form and tolerance.', pubmedId: '35184264' },
      { name: 'L-theanine', bestFit: 'Clinically backed calm wind-down support without heavy sedation', researchContext: 'L-theanine is studied for calm focus, relaxation, and sleep-quality related outcomes. It fits best when stress, racing thoughts, or wind-down difficulty are part of the sleep pattern.', typicalRange: 'Common range: 100–200 mg as needed or daily depending on product directions.', pubmedId: '31751906' },
      { name: 'Glycine', bestFit: 'Clinically studied sleep-quality and bedtime-routine comparison', researchContext: 'Glycine has human research in sleep-quality and next-day fatigue contexts, often as a bedtime amino-acid option. It is a comparison option, not a substitute for addressing hot flashes, caffeine timing, stress, or sleep schedule.', typicalRange: 'Common study range: about 3 g near bedtime; follow product directions.', pubmedId: '' },
      { name: 'Soy isoflavones', bestFit: 'Traditional / mixed-evidence menopause comfort comparison', researchContext: 'Soy isoflavones are studied as phytoestrogen compounds in menopause-related research, especially hot flash and comfort outcomes. Evidence and fit vary by person, diet pattern, product standardization, and medical context.', typicalRange: 'Dose varies by isoflavone content; compare label amounts and ask a qualified professional if you have hormone-sensitive conditions or medications.', pubmedId: '' },
      { name: 'Black cohosh', bestFit: 'Traditional botanical / mixed-evidence menopause support comparison', researchContext: 'Black cohosh is a traditional botanical commonly researched around menopause-related comfort and hot flash patterns, with mixed findings across studies. It deserves balanced review rather than automatic dismissal: compare extract type, quality, duration studied, and safety context.', typicalRange: 'Follow label directions for standardized extracts; review liver-related cautions and medication/pregnancy/nursing context with a qualified professional.', pubmedId: '' },
      { name: 'Saffron', bestFit: 'Emerging mood and sleep-quality comparison', researchContext: 'Saffron has emerging research in mood, stress, and sleep-quality related outcomes. It is best framed as an alternative comparison option when mood or stress load overlaps with sleep changes.', typicalRange: 'Common extract range in studies is often around 28–30 mg/day; follow label directions.', pubmedId: '' }
    ],
    jointMobility: [
      { name: 'Collagen peptides', bestFit: 'Connective-tissue and joint-support comparison', researchContext: 'Collagen peptides are studied in connective-tissue, tendon, skin, and joint-comfort contexts. They fit best as a longer-term comparison option alongside protein adequacy, strength work, and movement mechanics.', typicalRange: 'Common range: 5–15 g/day; follow label directions.', pubmedId: '33742704' },
      { name: 'Omega-3s', bestFit: 'Inflammatory-balance and general joint-support comparison', researchContext: 'Omega-3 fatty acids are researched for inflammatory balance and broad cardiometabolic support. They are a comparison option when joint comfort overlaps with low fish intake or general inflammation-support goals.', typicalRange: 'Common range: 1–2 g/day combined EPA/DHA depending on product and guidance.', pubmedId: '20439549' },
      { name: 'Curcumin / turmeric extract', bestFit: 'Botanical joint-comfort comparison', researchContext: 'Curcumin is a botanical compound commonly researched in joint-comfort and inflammatory-balance contexts. Absorption form and medication context matter, especially with blood thinners or surgery.', typicalRange: 'Follow product directions; many extracts are standardized and paired with absorption aids.', pubmedId: '' },
      { name: 'Glucosamine / chondroitin / MSM category', bestFit: 'Traditional joint-support category comparison', researchContext: 'These are common joint-support ingredients with mixed and situation-dependent evidence. They are best compared by form, dose, shellfish source, medication context, and trial period rather than treated as quick fixes.', typicalRange: 'Follow label directions; review shellfish allergy, blood thinner, diabetes, or medication context with a professional.', pubmedId: '' },
      { name: 'Magnesium', bestFit: 'Normal muscle function and tension-support comparison', researchContext: 'Magnesium supports normal muscle and nerve function and may be relevant when tightness, stress, or sleep quality overlaps with musculoskeletal discomfort. It does not replace evaluation for injury, weakness, or persistent pain.', typicalRange: 'Common supplemental range: 100–400 mg/day elemental magnesium depending on form and tolerance.', pubmedId: '35184264' }
    ],
    immune: [
      { name: 'Vitamin D3', bestFit: 'Immune and bone-health nutrient status comparison', researchContext: 'Vitamin D is researched for immune and bone-health support; blood levels help personalize need.', typicalRange: 'Common supplemental range: 1,000–2,000 IU/day, but blood levels and clinician guidance matter.', pubmedId: '32252338' },
      { name: 'Zinc', bestFit: 'Normal immune function support', researchContext: 'Zinc supports normal immune function; dose and duration matter because high zinc can affect copper status.', typicalRange: 'Common range: 10–30 mg/day; avoid long-term high-dose use without guidance.', pubmedId: '31305906' },
      { name: 'Vitamin C', bestFit: 'Antioxidant and immune nutrient support', researchContext: 'Vitamin C is a food-first immune nutrient and antioxidant support category.', typicalRange: 'Food-first sources include citrus, berries, kiwi, peppers, and broccoli.', pubmedId: '' },
      { name: 'Probiotics', bestFit: 'Gut-immune support comparison', researchContext: 'Gut and immune signaling overlap, so microbiome-support products are often compared in immune routines.', typicalRange: 'Typical label range varies by strain and purpose.', pubmedId: '35945628' }
    ],
    performance: [
      { name: 'Protein', bestFit: 'Training recovery and lean-mass support', researchContext: 'Adequate protein supports muscle repair and recovery routines when paired with resistance training and sleep.', typicalRange: 'Many plans use 20–40 g protein per serving/meal depending on body size and activity.', pubmedId: '28698222' },
      { name: 'Creatine', bestFit: 'Strength and power-output support', researchContext: 'Creatine monohydrate is widely studied for strength and power output.', typicalRange: 'Common range: 3–5 g/day creatine monohydrate.', pubmedId: '28615996' },
      { name: 'Electrolytes', bestFit: 'Hydration and mineral balance support', researchContext: 'Electrolytes support hydration balance around sweating, activity, travel, and low-carb eating patterns.', typicalRange: 'Follow label directions; needs vary with sweat losses, diet, medications, and health context.', pubmedId: '33127939' },
      { name: 'Magnesium', bestFit: 'Normal muscle function support', researchContext: 'Magnesium is commonly researched for normal muscle function and neuromuscular signaling.', typicalRange: 'Common supplemental range: 100–400 mg/day elemental magnesium.', pubmedId: '35184264' }
    ],
    beauty: [
      { name: 'Collagen peptides', bestFit: 'Skin and connective-tissue support', researchContext: 'Collagen peptides are researched for skin elasticity, joint comfort, and connective tissue support.', typicalRange: 'Common range: 5–15 g/day.', pubmedId: '33742704' },
      { name: 'Biotin', bestFit: 'Hair and nail nutrient comparison', researchContext: 'Biotin supports normal hair/skin/nail biology, but deficiency is uncommon and high doses can interfere with lab tests.', typicalRange: 'Label range varies widely; tell clinicians before bloodwork if using high-dose biotin.', pubmedId: '28879195' },
      { name: 'Zinc', bestFit: 'Skin and immune nutrient support', researchContext: 'Zinc supports normal skin and immune function; long-term high intake can affect copper status.', typicalRange: 'Common range: 10–30 mg/day.', pubmedId: '31305906' },
      { name: 'Omega-3s', bestFit: 'Skin barrier and inflammatory-balance comparison', researchContext: 'Omega-3s are researched for heart, brain, inflammatory balance, and skin-barrier support.', typicalRange: 'Common range: 1–2 g/day combined EPA/DHA depending on product and guidance.', pubmedId: '20439549' }
    ]
  };

  let key = 'general';
  if (pica) key = 'pica'; else if (reflux) key = 'reflux'; else if (bloat) key = 'bloat'; else if (constipation) key = 'constipation'; else if (menopauseSleep) key = 'menopauseSleep'; else if (sleepStress) key = 'sleepStress'; else if (immune) key = 'immune'; else if (jointMobility) key = 'jointMobility'; else if (performance) key = 'performance'; else if (beauty) key = 'beauty';

  const normalizeSuppliedIngredient = (i, idx) => {
    const rawName = i.name || i.nm || `Ingredient ${idx + 1}`;
    const name = /^joint complex$/i.test(String(rawName || '').trim()) ? 'Joint support nutrients' : rawName;
    const rawBestFit = i.bestFit || i.b || '';
    return {
      name,
      bestFit: String(rawBestFit || ingredientNutritionRole(name) || '').replace(/^(Top Match|Additional Option to Compare):\s*/i, ''),
      researchContext: i.researchContext || i.detail || ingredientNutritionSummary(name),
      mechanism: i.mechanism || ingredientMechanism(name),
      typicalRange: i.typicalRange || i.dose || ingredientTypicalRange(name),
      pubmedId: i.pubmedId || i.id || ''
    };
  };
  const supplementalIngredients = (ingredients || []).map(normalizeSuppliedIngredient);
  const baseIngredients = ingredientPool[key] || [];
  const seenIngredientNames = new Set();
  const chosenIngredients = [...baseIngredients, ...supplementalIngredients]
    .filter(i => {
      const name = String(i.name || '').toLowerCase();
      if (!name || seenIngredientNames.has(name)) return false;
      seenIngredientNames.add(name);
      return true;
    })
    .slice(0, 12)
    .map(i => ({ ...i, mechanism: i.mechanism || ingredientMechanism(i.name) }));
  const suppliedProducts = (products || []).slice(0, 4).map(p => ({ name: p.name || p.n, brand: productBrand(p.name || p.n, p.brand), url: p.url || p.u || '', u: p.u || p.url || '', price: p.price || p.p || '', imageUrl: p.imageUrl || p.img || '', why: p.why || p.w || 'Closest product fit from the NutraPass catalog' }));
  const productMap = {
    pica: [{ name: 'Ultimate Wellness Bundle', why: 'Broad daily wellness comparison only; prioritize clinician-guided iron-status evaluation before supplement choices' }, { name: 'Stress Complex', why: 'Sleep and shift-work routine support comparison' }],
    reflux: [{ name: 'Upper GI Relief', why: 'Upper digestive comfort comparison' }, { name: 'Reflux Plus Kit', why: 'Acid/reflux support kit comparison' }, { name: 'Digestive Enzyme', why: 'Meal-time digestion support comparison' }],
    bloat: [{ name: 'Bloat Relief Kit', why: 'Bloat and gas support comparison' }, { name: 'Bloat & Gas Relief', why: 'FODMAP-related comfort comparison' }, { name: 'Complete Biotic Kit', why: 'Microbiome support comparison' }],
    constipation: [{ name: 'Motility - Constipation Support', why: 'Non-laxative motility support comparison' }, { name: 'Regularity', why: 'Regularity support comparison' }, { name: 'Ultimate Fiber', why: 'Prebiotic fiber comparison' }],
    sleepStress: [{ name: 'Stress Complex', why: 'Calm and sleep routine support comparison' }, { name: 'The Burnout Kit', why: 'Stress and fatigue stack comparison' }],
    menopauseSleep: [{ name: 'Stress Complex', why: 'Calm wind-down and sleep-routine support comparison' }, { name: 'The Burnout Kit', why: 'Stress and low-energy routine comparison when fatigue overlaps with sleep disruption' }],
    jointMobility: [{ name: 'Joint Complex', why: 'Joint comfort and mobility routine comparison' }, { name: 'Hair Skin & Nails', why: 'Collagen/beauty-from-within product to compare when connective-tissue nutrients are relevant' }],
    immune: [{ name: 'Immune+ Protocol', why: 'Immune system support comparison' }, { name: 'Postbiotic+', why: 'Gut and immune support comparison' }, { name: 'Whole Food Multivitamin', why: 'Daily vitamin/mineral foundation comparison' }],
    performance: [{ name: 'H2O Electrolytes', why: 'Hydration and electrolyte balance support' }, { name: 'Build - Strength & Muscle', why: 'Training and recovery routine support' }, { name: 'Build Up Protocol', why: 'Stack for build goals comparison' }],
    beauty: [{ name: 'Hair Skin & Nails', why: 'Beauty-from-within support comparison' }, { name: 'Hair Complex - Keratin & Silica', why: 'Hair strength nutrient comparison' }]
  };
  const chosenProducts = (productMap[key] || suppliedProducts).map(p => ({
    ...p,
    brand: productBrand(p.name, p.brand),
    url: p.url || p.u || '',
    u: p.u || p.url || '',
    price: p.price || p.p || '',
    imageUrl: p.imageUrl || p.img || '',
    img: p.img || p.imageUrl || ''
  }));

  const overviewMap = {
    pica: 'Nutritional Key Points: craving ice or non-food items plus restless legs can sometimes overlap with iron-status questions, low ferritin, B-vitamin status, sleep disruption, stress load, pregnancy, heavy menstrual bleeding, or absorption issues. This is worth lab-based follow-up rather than guessing from symptoms alone.\n\nFood first: compare iron-containing foods such as lean meats, seafood, beans, lentils, tofu, spinach, pumpkin seeds, and fortified foods; pair plant iron with vitamin C-rich foods like citrus, berries, kiwi, bell pepper, or broccoli.\n\nEasy things to try: track when cravings or restless-leg sensations happen, note energy, dizziness, shortness of breath, menstrual/blood-loss context, caffeine timing, and sleep schedule, then ask a clinician about CBC, ferritin, and iron studies if it persists.',
    reflux: 'Nutritional Key Points: upper-digestive discomfort can be influenced by meal size, eating pace, late-night meals, higher-fat meals, caffeine/alcohol, spicy or acidic foods, mint/chocolate triggers, stress, and individual tolerance patterns. Burning, chest discomfort, trouble swallowing, vomiting blood, or unexplained weight loss should be handled medically.\n\nFood first: try smaller balanced meals, lower-fat evening meals, oatmeal, bananas, lean proteins, cooked vegetables, and non-mint herbal tea if tolerated.\n\nEasy things to try: avoid lying down right after eating, leave 2–3 hours before bed, slow down meals, and track triggers such as coffee, alcohol, chocolate, mint, spicy foods, and large late meals.',
    bloat: 'Nutritional Key Points: bloating and gas patterns can be influenced by how quickly meals are eaten, fermentable carbohydrates/FODMAP load, constipation or slow transit, microbiome shifts, fiber changes, carbonated drinks, stress, and food tolerance.\n\nFood first: use simple tolerated foods while observing patterns: oats, rice/potatoes, lean protein, cooked vegetables, kiwi, yogurt/kefir if tolerated, and adequate fluids. Increase beans, cruciferous vegetables, and high-fiber foods gradually.\n\nEasy things to try: walk 5–10 minutes after meals, eat slower, keep a food/symptom log, avoid changing several foods or supplements at once, and notice whether symptoms track with dairy, wheat, onions/garlic, carbonated drinks, or large portions.',
    constipation: 'Nutritional Key Points: regularity issues can be influenced by fluid intake, fiber type, low food volume, travel, schedule changes, inactivity, stress, medications, magnesium intake, and normal motility patterns.\n\nFood first: compare kiwi, prunes, oats, chia/flax, beans/lentils as tolerated, cooked vegetables, enough fluids, and regular meals rather than skipping food all day.\n\nEasy things to try: build a consistent morning routine, walk daily, increase fiber gradually, pair fiber with water, and track whether travel, stress, or low meal volume changes bowel patterns.',
    sleepStress: 'Nutritional Key Points: sleep, stress, and low-energy patterns can be influenced by caffeine timing, inconsistent sleep/wake rhythm, evening light exposure, high stress load, under-eating, low protein, low magnesium intake, overtraining, alcohol, and mood or thyroid/iron/B12 issues.\n\nFood first: include protein at meals, magnesium-rich foods such as pumpkin seeds/spinach/beans, complex carbs at dinner if tolerated, steady hydration, and lower caffeine intake after late morning or early afternoon.\n\nEasy things to try: set a consistent wind-down time, dim screens/lights before bed, get morning daylight, keep workouts earlier if they feel stimulating, and use breathing or a short walk to downshift stress.',
    menopauseSleep: 'Nutritional Key Points: sleep changes during menopause or perimenopause may be influenced by hormonal transition, hot flashes or night sweats, stress load, caffeine/alcohol timing, evening light exposure, blood-sugar rhythm, mood changes, and iron/B12/thyroid or magnesium status. This is common enough to explore thoughtfully, but persistent or severe sleep disruption, heavy bleeding, mood changes, or medication questions deserve professional guidance.\n\nFood first: anchor protein at meals, include magnesium-rich foods such as pumpkin seeds/spinach/beans, consider soy foods if tolerated, keep alcohol and late caffeine modest, and use steady hydration without overdoing fluids right before bed.\n\nEasy things to try: cool the room, use breathable layers, get morning daylight, dim screens/lights before bed, track hot flashes/night sweats and caffeine/alcohol timing, and change one supplement or routine variable at a time.',
    jointMobility: 'Nutritional Key Points: a crunchy, painful shoulder can come from several non-diagnosis patterns, including tendon irritation, joint mechanics, old injury, overuse, posture/desk load, strength imbalance, or normal crepitus that becomes more concerning when pain is present. New severe pain, swelling, numbness, weakness, instability, injury, fever, or worsening range of motion deserves professional evaluation.\n\nFood first: support connective tissue and recovery basics with enough protein, colorful produce for vitamin C/polyphenols, omega-3-rich fish or seeds, hydration, and consistent meals.\n\nEasy things to try: reduce painful loading for a few days, note what motions trigger it, use gentle range-of-motion rather than forcing through pain, and consider a physical therapist or clinician if it persists or limits daily movement.',
    immune: 'Nutritional Key Points: immune-support needs are often shaped by sleep quality, stress load, vitamin D status, protein intake, gut health, hydration, seasonal exposure, and overall diet quality. Frequent, severe, or prolonged infections should be discussed with a clinician.\n\nFood first: focus on colorful fruits/vegetables, citrus or berries, protein with each meal, zinc foods like seafood/meat/pumpkin seeds, fermented foods, and steady hydration.\n\nEasy things to try: prioritize sleep, wash hands, keep workouts moderate when run down, get daylight, and avoid megadosing single nutrients for long periods.',
    performance: 'Nutritional Key Points: body-composition, cramping, soreness, and performance goals can be influenced by protein distribution, training progression, hydration/electrolytes, sleep, total energy intake, magnesium status, and recovery time. Sudden one-sided calf pain, swelling, warmth, chest pain, or shortness of breath should be treated as urgent.\n\nFood first: build protein-forward meals, high-fiber carbs around activity, fruits/vegetables, and fluids with electrolytes when sweating.\n\nEasy things to try: lift consistently, walk daily, plan protein at breakfast, stretch or mobilize tight areas gently, sleep enough for recovery, and track progress with strength/energy/waist or fit rather than day-to-day scale noise only.',
    beauty: 'Nutritional Key Points: hair, skin, and nail changes can be influenced by protein intake, iron/zinc status, essential fatty acids, thyroid or hormone changes, stress load, biotin status, collagen support, skin barrier habits, and normal growth cycles. Sudden hair loss, brittle nails, or major skin changes should be evaluated.\n\nFood first: prioritize adequate protein, vitamin-C foods, eggs/fish/lean meats or legumes, nuts/seeds, colorful produce, omega-3-rich foods, and enough calories overall.\n\nEasy things to try: be consistent for 8–12+ weeks, avoid crash dieting, protect sleep, simplify harsh skin/hair routines, and consider labs if changes are sudden or persistent.'
  };

  return {
    summary: key === 'general' ? 'I can help narrow this into a more useful NutraPass research summary with one quick direction.' : `I’m reading this as a ${key.replace('sleepStress', 'sleep/stress').replace('pica', 'iron-status / unusual-craving').replace('jointMobility', 'joint/mobility')} support question, so the overview is tailored to that pattern.`,
    nutritionOverview: overviewMap[key] || 'Nutritional Key Points: I need one more clue to make this useful instead of guessing. What is the main thing you want help comparing — digestion, energy, sleep/stress, body composition, immunity, joint/mobility, or hair/skin/nails?\n\nFood first: once the main pattern is clear, start with the simplest meal or routine lever connected to that goal.\n\nEasy things to try: pick one focus area, note timing and triggers for a few days, and avoid adding multiple supplements at once.',
    ingredientNotes: chosenIngredients,
    products: chosenProducts
  };
}

function selectAiProvider(body, env) {
  const requested = String(body.aiProvider || body.provider || env.AI_PROVIDER || env.NUTRAPASS_AI_PROVIDER || 'openai').toLowerCase();
  const hasOpenAi = Boolean(env.OPENAI_API_KEY);
  const hasClaude = Boolean(env.ANTHROPIC_API_KEY);

  if ((requested === 'claude' || requested === 'anthropic') && hasClaude) return 'claude';
  if ((requested === 'openai' || requested === 'gpt') && hasOpenAi) return 'openai';
  if ((requested === 'ab' || requested === 'a/b' || requested === 'split') && hasOpenAi && hasClaude) {
    return Math.random() < 0.5 ? 'openai' : 'claude';
  }
  if (hasOpenAi) return 'openai';
  if (hasClaude) return 'claude';
  return 'fallback';
}

async function callOpenAi(env, userPayload) {
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) }
      ]
    })
  });
  if (!openaiResponse.ok) {
    const err = await openaiResponse.text();
    throw new Error(`openai_error: ${err.slice(0, 300)}`);
  }
  const data = await openaiResponse.json();
  return data.choices?.[0]?.message?.content || '{}';
}

async function callOpenAiFollowUp(env, userPayload) {
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: FOLLOW_UP_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) }
      ]
    })
  });
  if (!openaiResponse.ok) {
    const err = await openaiResponse.text();
    throw new Error(`openai_error: ${err.slice(0, 300)}`);
  }
  const data = await openaiResponse.json();
  return data.choices?.[0]?.message?.content || '{}';
}

async function callClaude(env, userPayload) {
  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      // Claude needs enough room for the 10–12 ranked ingredient JSON payload;
      // too small a cap can truncate mid-string and force static fallback.
      max_tokens: Number(env.ANTHROPIC_MAX_TOKENS || 4000),
      temperature: 0.35,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Return strict JSON only. Input:\n${JSON.stringify(userPayload)}` }
      ]
    })
  });
  if (!claudeResponse.ok) {
    const err = await claudeResponse.text();
    throw new Error(`claude_error: ${err.slice(0, 300)}`);
  }
  const data = await claudeResponse.json();
  return (data.content || []).map(part => part?.text || '').join('\n').trim() || '{}';
}

async function callClaudeFollowUp(env, userPayload) {
  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: Number(env.ANTHROPIC_FOLLOWUP_MAX_TOKENS || 1600),
      temperature: 0.3,
      system: FOLLOW_UP_PROMPT,
      messages: [
        { role: 'user', content: `Return strict JSON only. Input:\n${JSON.stringify(userPayload)}` }
      ]
    })
  });
  if (!claudeResponse.ok) {
    const err = await claudeResponse.text();
    throw new Error(`claude_error: ${err.slice(0, 300)}`);
  }
  const data = await claudeResponse.json();
  return (data.content || []).map(part => part?.text || '').join('\n').trim() || '{}';
}

function asksAboutPrivacyOrData(question) {
  const q = String(question || '').toLowerCase();
  return /\b(data|personal information|personal info|privacy|private|collect|collecting|collection|save|saving|saved|store|storing|stored|remember|remembering|know about me|have about me|profile|account)\b/.test(q)
    && /\b(you|nutrapass|my|me|this tool|question|report|data|information|privacy)\b/.test(q);
}

const DISALLOWED_QUESTION_RESPONSE = 'I can’t help with vulgar, abusive, or aggressively sexual questions. NutraPass is here for respectful wellness and product research.';

function asksVulgarAbusiveOrSexualQuestion(question) {
  const q = ` ${String(question || '').toLowerCase().replace(/[\u2019']/g, "'").replace(/[^a-z0-9'*]+/g, ' ')} `;
  if (!q.trim()) return false;

  const vulgarTerms = /\b(fuck(?:ing|er|ers|ed)?|shit(?:ty)?|bullshit|bitch(?:es)?|asshole|dickhead|cunt|slut|whore|bastard|motherfucker)\b/;
  const abusivePhrases = /\b(kill yourself|kys|go die|you suck|you are stupid|you're stupid|idiot|moron|retard(?:ed)?|shut up)\b/;
  const aggressiveSexualTerms = /\b(suck my|blowjob|handjob|cum|jizz|porn|nude|nudes|naked pics|sex tape|rape|raping|incest|bestiality|fuck me|fuck you|dildo|anal sex|cock|pussy)\b/;

  return vulgarTerms.test(q) || abusivePhrases.test(q) || aggressiveSexualTerms.test(q);
}

function disallowedQuestionAnswerPayload() {
  return {
    answer: DISALLOWED_QUESTION_RESPONSE,
    gaps: [],
    products: [],
    noResults: true,
    type: 'content_safety'
  };
}

function disallowedQuestionReportPayload() {
  return {
    summary: DISALLOWED_QUESTION_RESPONSE,
    nutritionOverview: '',
    ingredientNotes: [],
    products: [],
    noResults: true,
    type: 'content_safety'
  };
}

const MEDICAL_REDIRECT_RESPONSE = 'NutraPass can’t answer cancer, oncology, or serious-disease treatment questions. Please work with a qualified healthcare professional for that situation.';
const OUT_OF_SCOPE_RESPONSE = 'NutraPass is built for nutrition, wellness, ingredient, and product research. I can’t help with that question here.';

function asksAboutCancerOrSeriousTreatment(question) {
  const q = ` ${String(question || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return /\b(cancer|tumor|tumour|oncology|oncologist|chemo|chemotherapy|radiation therapy|radiotherapy|leukemia|lymphoma|melanoma|carcinoma|metastatic|metastasis|malignant)\b/.test(q);
}

function asksClearlyNonNutritionQuestion(question) {
  const q = ` ${String(question || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const nutritionTerms = /\b(nutrition|nutrient|supplement|vitamin|mineral|protein|fiber|diet|food|meal|hydration|electrolyte|gut|digestion|sleep|stress|energy|immune|joint|skin|hair|nail|weight|workout|wellness|ingredient|product|label)\b/;
  if (nutritionTerms.test(q)) return false;
  return /\b(code|javascript|python|sql|tax|legal|lawsuit|contract|stock|crypto|weather|sports score|car repair|homework|essay|movie|travel itinerary|flight|hotel|politics|election)\b/.test(q);
}

function noResultsAnswerPayload(message, type) {
  return {
    answer: message,
    gaps: [],
    products: [],
    noResults: true,
    type
  };
}

function noResultsReportPayload(message, type) {
  return {
    summary: message,
    nutritionOverview: '',
    ingredientNotes: [],
    products: [],
    noResults: true,
    type
  };
}

function privacyPolicyAnswerPayload() {
  return {
    answer: 'NutraPass is not collecting, selling, or saving your personal data from this tool. NutraPass does not save your questions, follow-up questions, or generated reports on our servers.\n\nWhen AI is active, the text you type and relevant results context are sent securely to our AI provider only to generate the response. Please avoid entering names, contact details, account numbers, or highly sensitive medical details.',
    gaps: [],
    products: [],
    noResults: true
  };
}

function privacyPolicyReportPayload() {
  const answer = privacyPolicyAnswerPayload().answer;
  return {
    summary: 'NutraPass is not collecting, selling, or saving your personal data from this tool.',
    nutritionOverview: answer,
    ingredientNotes: [],
    products: [],
    noResults: true,
    type: 'privacy'
  };
}

function asksAboutOffCatalogProduct(question) {
  const q = String(question || '').toLowerCase();
  return /not on nutrapass|not available|outside nutrapass|what about|which brand|brand|label|supplement facts|proprietary blend/.test(q);
}

function staticFollowUpFallback(question, report = {}) {
  const asksOutsideProduct = asksAboutOffCatalogProduct(question);
  const products = asksOutsideProduct ? [] : (Array.isArray(report.products) ? report.products.slice(0, 2) : []);
  const ingredients = Array.isArray(report.ingredients) ? report.ingredients.slice(0, 4).map(i => i.name || i.nm).filter(Boolean) : [];
  const ingredientText = ingredients.length ? ` The strongest comparison areas above include ${ingredients.join(', ')}.` : '';
  const qualityText = ' If the exact product is not on NutraPass, look for a clear Supplement Facts panel, named ingredient forms and amounts, third-party testing or cGMP quality cues, low reliance on proprietary blends, allergen/sweetener clarity, and serving-size math that matches the research context.';
  return {
    answer: asksOutsideProduct
      ? `Use the results above as your ingredient checklist, then judge the outside product by label quality rather than marketing claims.${qualityText} Avoid stacking it with similar formulas until you compare overlap and tolerance.`
      : `Based on the NutraPass results above, use this follow-up as a refinement step rather than starting over.${ingredientText} Track the specific timing, food triggers, medications, and tolerance details behind your question, then compare the ingredient and product matches above against those details. Keep food, sleep, hydration, and routine changes as the foundation.`,
    gaps: asksOutsideProduct ? [] : [
      'What timing, food trigger, or routine detail would make this answer more useful?'
    ],
    products
  };
}

function staticClinicalLookupFallback(term) {
  const name = String(term || '').trim() || 'this ingredient';
  const lower = name.toLowerCase();
  let summary = `${name} is a supplement ingredient research topic. Evidence quality depends on the exact form, dose, population studied, duration, outcomes measured, and safety context. Use the links below as educational research starting points, not as medical advice or a recommendation to take it.`;
  if (/magnesium/.test(lower)) summary = 'Magnesium is an essential mineral involved in normal muscle function, nerve signaling, energy metabolism, and relaxation routines. Research varies by form, dose, population, and outcome, so compare the exact form used in a study with the product label.';
  else if (/vitamin\s*d|d3/.test(lower)) summary = 'Vitamin D is a fat-soluble nutrient commonly studied for bone health, immune function, muscle function, and nutrient status. Blood levels, baseline deficiency, dose, and co-nutrients such as calcium or vitamin K can change how evidence applies.';
  else if (/berberine/.test(lower)) summary = 'Berberine is a plant alkaloid studied mostly in metabolic-wellness contexts. It has meaningful interaction and tolerability considerations, so review safety carefully rather than treating it as a casual add-on.';
  else if (/ashwagandha/.test(lower)) summary = 'Ashwagandha is an adaptogenic herb studied for perceived stress, sleep quality, and resilience markers. Extract type, withanolide standardization, thyroid context, pregnancy/nursing, autoimmune issues, and medication use matter.';
  else if (/creatine/.test(lower)) summary = 'Creatine, especially creatine monohydrate, is widely studied for strength, power output, lean-mass support, and training adaptation. Hydration, dose consistency, and kidney-related medical context should be considered.';
  else if (/omega|fish oil|epa|dha/.test(lower)) summary = 'Omega-3 fatty acids such as EPA and DHA are studied for heart, brain, inflammatory-balance, and general wellness contexts. Compare actual EPA+DHA per serving, not just total fish oil, and review bleeding-risk or medication considerations.';
  return { summary, links: [], mode: 'fallback_clinical_static', type: 'clinicalLookup' };
}

async function callOpenAiClinicalLookup(env, userPayload) {
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.25,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLINICAL_LOOKUP_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) }
      ]
    })
  });
  if (!openaiResponse.ok) {
    const err = await openaiResponse.text();
    throw new Error(`openai_error: ${err.slice(0, 300)}`);
  }
  const data = await openaiResponse.json();
  return data.choices?.[0]?.message?.content || '{}';
}

async function callClaudeClinicalLookup(env, userPayload) {
  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: Number(env.ANTHROPIC_LOOKUP_MAX_TOKENS || 1800),
      temperature: 0.25,
      system: CLINICAL_LOOKUP_PROMPT,
      messages: [
        { role: 'user', content: `Return strict JSON only. Input:\n${JSON.stringify(userPayload)}` }
      ]
    })
  });
  if (!claudeResponse.ok) {
    const err = await claudeResponse.text();
    throw new Error(`claude_error: ${err.slice(0, 300)}`);
  }
  const data = await claudeResponse.json();
  return (data.content || []).map(part => part?.text || '').join('\n').trim() || '{}';
}

function hasGenericWellnessFiller(parsed) {
  const text = JSON.stringify(parsed || {}).toLowerCase();
  return /does not match (one )?(narrow )?category/.test(text)
    || text.includes('broad wellness drivers')
    || text.includes('meal quality, protein and fiber intake, hydration, sleep rhythm, stress load')
    || text.includes('meal quality, protein, fiber, hydration, sleep, stress, movement, nutrient gaps')
    || text.includes('internal routing')
    || text.includes('category matching');
}

async function rewriteGenericWellnessAnswer(provider, env, userPayload, parsed, followup = false) {
  const correction = 'Rewrite this as a specific, helpful NutraPass answer. Do not mention category matching, routing, or broad wellness drivers. If the user intent is unclear, ask one short clarifying question instead of giving a broad overview. If there is any usable clue, choose the closest wellness pattern and answer specifically. Return strict JSON only in the required schema.';
  const retryPayload = {
    ...userPayload,
    correction,
    previousDraftToFix: parsed
  };
  return followup
    ? (provider === 'claude' ? callClaudeFollowUp(env, retryPayload) : callOpenAiFollowUp(env, retryPayload))
    : (provider === 'claude' ? callClaude(env, retryPayload) : callOpenAi(env, retryPayload));
}

export default {
  async fetch(request, env, ctx) {
    const requestStartedAt = Date.now();
    const allowOrigin = pickOrigin(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: privacyHeaders(allowOrigin) });
    const url = new URL(request.url);
    if ((request.method === 'GET' || request.method === 'HEAD') && /^\/question-analytics\/?$/.test(url.pathname)) {
      if (!canReadAnalytics(request, env)) return json({ error: 'Not found' }, 404, allowOrigin);
      return json(await getQuestionAnalyticsSummary(env), 200, allowOrigin);
    }
    if (request.method === 'POST' && /^\/simplero-webhook\/?$/.test(url.pathname)) {
      return handleSimpleroWebhook(request, env, url, allowOrigin);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && /^\/(products|product-catalog)\/?$/.test(url.pathname)) {
      return json(await getProductCatalog(env), 200, allowOrigin);
    }
    if (request.method === 'POST' && /^\/(products|product-catalog)\/refresh\/?$/.test(url.pathname)) {
      return json(await refreshProductCatalogCache(env, 'manual_refresh'), 200, allowOrigin);
    }
    if (request.method === 'GET' || request.method === 'HEAD') return healthPage(allowOrigin);
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, allowOrigin);

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413, allowOrigin);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON body' }, 400, allowOrigin); }

    const turnstile = await verifyTurnstile(env, body.turnstileToken, request.headers.get('CF-Connecting-IP') || '');
    if (!turnstile.ok) return json({ error: turnstile.error || 'Turnstile verification failed' }, 403, allowOrigin);

    if (body.productCatalog === true || body.liveProducts === true) {
      return json(await getProductCatalog(env), 200, allowOrigin);
    }
    if (body.refreshProductCatalog === true) {
      return json(await refreshProductCatalogCache(env, 'manual_refresh'), 200, allowOrigin);
    }

    const clinicalLookup = String(body.clinicalLookup || body.lookupIngredient || '').slice(0, 160);
    if (clinicalLookup.trim()) {
      const lookupPayload = {
        ingredient: clinicalLookup,
        requiredDisclaimer: 'Educational information only; not medical advice; not intended to diagnose, treat, cure, or prevent any disease.',
        linkPreference: 'Return durable research/search links only. Do not invent PubMed IDs.'
      };
      if (asksVulgarAbusiveOrSexualQuestion(clinicalLookup)) {
        trackDaily(ctx, env, { kind: 'clinical', intent: 'other', aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...disallowedQuestionReportPayload(), mode: 'content_safety_static' }, 200, allowOrigin);
      }
      if (asksAboutCancerOrSeriousTreatment(clinicalLookup)) {
        trackDaily(ctx, env, { kind: 'clinical', intent: 'other', aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...noResultsReportPayload(MEDICAL_REDIRECT_RESPONSE, 'medical_redirect'), mode: 'medical_redirect_static' }, 200, allowOrigin);
      }
      if (asksClearlyNonNutritionQuestion(clinicalLookup)) {
        trackDaily(ctx, env, { kind: 'clinical', intent: 'other', aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...noResultsReportPayload(OUT_OF_SCOPE_RESPONSE, 'out_of_scope'), mode: 'out_of_scope_static' }, 200, allowOrigin);
      }
      const provider = selectAiProvider(body, env);
      if (provider === 'fallback') {
        trackDaily(ctx, env, { kind: 'clinical', intent: 'other', aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json(staticClinicalLookupFallback(clinicalLookup), 200, allowOrigin);
      }
      try {
        const content = provider === 'claude'
          ? await callClaudeClinicalLookup(env, lookupPayload)
          : await callOpenAiClinicalLookup(env, lookupPayload);
        const parsed = safeParseJson(content);
        trackDaily(ctx, env, { kind: 'clinical', intent: 'other', aiUsed: true, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...parsed, mode: provider === 'claude' ? 'claude' : 'openai', type: 'clinicalLookup' }, 200, allowOrigin);
      } catch (error) {
        trackDaily(ctx, env, { kind: 'clinical', intent: 'other', aiUsed: true, cacheHit: false, error: true, responseMs: Date.now() - requestStartedAt });
        return json({ ...staticClinicalLookupFallback(clinicalLookup), mode: `fallback_${provider}_clinical_error`, error: 'AI provider unavailable; static clinical lookup fallback used.' }, 200, allowOrigin);
      }
    }

    const followUpQuestion = String(body.followUpQuestion || body.followup || body.question || '').slice(0, 700);
    if (followUpQuestion.trim()) {
      if (asksVulgarAbusiveOrSexualQuestion(followUpQuestion)) {
        trackDaily(ctx, env, { kind: 'followup', intent: 'other', aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...disallowedQuestionAnswerPayload(), mode: 'content_safety_static', type: 'followup' }, 200, allowOrigin);
      }
      if (asksAboutCancerOrSeriousTreatment(followUpQuestion)) {
        trackDaily(ctx, env, { kind: 'followup', intent: 'other', aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...noResultsAnswerPayload(MEDICAL_REDIRECT_RESPONSE, 'medical_redirect'), mode: 'medical_redirect_static', type: 'followup' }, 200, allowOrigin);
      }
      if (asksClearlyNonNutritionQuestion(followUpQuestion)) {
        trackDaily(ctx, env, { kind: 'followup', intent: 'other', aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...noResultsAnswerPayload(OUT_OF_SCOPE_RESPONSE, 'out_of_scope'), mode: 'out_of_scope_static', type: 'followup' }, 200, allowOrigin);
      }
      if (asksAboutPrivacyOrData(followUpQuestion)) {
        trackDaily(ctx, env, { kind: 'followup', intent: 'other', aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...privacyPolicyAnswerPayload(), mode: 'privacy_policy_static', type: 'followup' }, 200, allowOrigin);
      }
      const report = body.report && typeof body.report === 'object' ? body.report : {};
      const followPayload = {
        followUpQuestion,
        originalGoal: String(report.goal || body.goal || '').slice(0, 800),
        originalSummary: String(report.summary || '').slice(0, 1000),
        originalHealthOverview: String(report.overview || report.nutritionOverview || '').slice(0, 1600),
        ingredients: Array.isArray(report.ingredients) ? report.ingredients.slice(0, 12) : [],
        products: Array.isArray(report.products) ? report.products.slice(0, 6) : [],
        previousFollowUps: Array.isArray(body.history) ? body.history.slice(-6) : [],
        requiredDisclaimer: 'Educational information only; not medical advice; not intended to diagnose, treat, cure, or prevent any disease.'
      };
      const provider = selectAiProvider(body, env);
      if (provider === 'fallback') {
        trackDaily(ctx, env, { kind: 'followup', intent: 'other', aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...staticFollowUpFallback(followUpQuestion, report), mode: 'fallback_no_ai_key', type: 'followup' }, 200, allowOrigin);
      }
      try {
        const content = provider === 'claude'
          ? await callClaudeFollowUp(env, followPayload)
          : await callOpenAiFollowUp(env, followPayload);
        let parsed = safeParseJson(content);
        if (hasGenericWellnessFiller(parsed)) {
          const rewritten = await rewriteGenericWellnessAnswer(provider, env, followPayload, parsed, true);
          parsed = safeParseJson(rewritten);
        }
        if (asksAboutOffCatalogProduct(followUpQuestion)) parsed.products = [];
        trackDaily(ctx, env, { kind: 'followup', intent: 'other', aiUsed: true, cacheHit: false, responseMs: Date.now() - requestStartedAt });
        return json({ ...parsed, mode: provider === 'claude' ? 'claude' : 'openai', type: 'followup' }, 200, allowOrigin);
      } catch (error) {
        trackDaily(ctx, env, { kind: 'followup', intent: 'other', aiUsed: true, cacheHit: false, error: true, responseMs: Date.now() - requestStartedAt });
        return json({ ...staticFollowUpFallback(followUpQuestion, report), mode: `fallback_${provider}_error`, type: 'followup', error: 'AI provider unavailable; static educational fallback used.' }, 200, allowOrigin);
      }
    }

    const goal = String(body.goal || '').slice(0, 800);
    const products = Array.isArray(body.products) ? body.products.slice(0, 24) : [];
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients.slice(0, 20) : [];
    const intent = classifyCommonIntent(goal);
    if (!goal.trim()) return json({ error: 'Missing goal' }, 400, allowOrigin);
    if (asksVulgarAbusiveOrSexualQuestion(goal)) {
      trackDaily(ctx, env, { kind: 'research', intent, aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
      return json({ ...disallowedQuestionReportPayload(), mode: 'content_safety_static', cacheHit: false, aiUsed: false }, 200, allowOrigin);
    }
    if (asksAboutCancerOrSeriousTreatment(goal)) {
      trackDaily(ctx, env, { kind: 'research', intent, aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
      return json({ ...noResultsReportPayload(MEDICAL_REDIRECT_RESPONSE, 'medical_redirect'), mode: 'medical_redirect_static', cacheHit: false, aiUsed: false }, 200, allowOrigin);
    }
    if (asksClearlyNonNutritionQuestion(goal)) {
      trackDaily(ctx, env, { kind: 'research', intent, aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
      return json({ ...noResultsReportPayload(OUT_OF_SCOPE_RESPONSE, 'out_of_scope'), mode: 'out_of_scope_static', cacheHit: false, aiUsed: false }, 200, allowOrigin);
    }
    if (asksAboutPrivacyOrData(goal)) {
      trackDaily(ctx, env, { kind: 'research', intent, aiUsed: false, cacheHit: false, responseMs: Date.now() - requestStartedAt });
      return json({ ...privacyPolicyReportPayload(), mode: 'privacy_policy_static', cacheHit: false, aiUsed: false }, 200, allowOrigin);
    }
    const provider = selectAiProvider(body, env);

    // Prefer a fresh AI response whenever a provider key is available.
    // The common template/cache path is only a non-AI fallback for environments
    // without usable provider credentials, or when explicitly requested.
    const useCommonFallback = shouldUseCommonFastPath(body, goal) && (provider === 'fallback' || body.useCommonFastPath === true);
    if (useCommonFallback) {
      const cached = await readCommonResponseCache(env, intent);
      const freshResponse = buildCommonIntentResponse(intent, products);
      const response = cached || await writeCommonResponseCache(env, intent, { ...freshResponse, products: [] });
      const payload = enrichProductLinks({ ...response, products: freshResponse.products || [] }, products);
      if (ctx && ctx.waitUntil) ctx.waitUntil(recordQuestionAnalytics(env, {
        intent,
        cacheHit: Boolean(cached),
        aiUsed: false,
        responseMs: Date.now() - requestStartedAt
      }));
      trackDaily(ctx, env, { kind: 'research', intent, cacheHit: Boolean(cached), aiUsed: false, responseMs: Date.now() - requestStartedAt });
      return json({ ...payload, mode: cached ? 'common_cache_hit' : 'common_template_cached', cacheHit: Boolean(cached), aiUsed: false }, 200, allowOrigin);
    }

    const userPayload = {
      userQuestion: goal,
      approvedProductsFromPage: products,
      approvedIngredientsFromPage: ingredients,
      approvedProductCatalog: products.length ? products : PRODUCT_CATALOG,
      requiredDisclaimer: 'Educational information only; not medical advice; not intended to diagnose, treat, cure, or prevent any disease.'
    };

    if (provider === 'fallback') {
      if (ctx && ctx.waitUntil) ctx.waitUntil(recordQuestionAnalytics(env, {
        intent,
        cacheHit: false,
        aiUsed: false,
        responseMs: Date.now() - requestStartedAt
      }));
      trackDaily(ctx, env, { kind: 'research', intent, cacheHit: false, aiUsed: false, responseMs: Date.now() - requestStartedAt });
      return json({ ...staticFallback(goal, products, ingredients), mode: 'fallback_no_ai_key' }, 200, allowOrigin);
    }

    try {
      const content = provider === 'claude'
        ? await callClaude(env, userPayload)
        : await callOpenAi(env, userPayload);
      let parsed = safeParseJson(content);
      if (hasGenericWellnessFiller(parsed)) {
        const rewritten = await rewriteGenericWellnessAnswer(provider, env, userPayload, parsed);
        parsed = safeParseJson(rewritten);
      }
      if (ctx && ctx.waitUntil) ctx.waitUntil(recordQuestionAnalytics(env, {
        intent,
        cacheHit: false,
        aiUsed: true,
        responseMs: Date.now() - requestStartedAt
      }));
      trackDaily(ctx, env, { kind: 'research', intent, cacheHit: false, aiUsed: true, responseMs: Date.now() - requestStartedAt });
      return json({ ...enrichProductLinks(parsed, products), mode: provider === 'claude' ? 'claude' : 'openai', cacheHit: false, aiUsed: true }, 200, allowOrigin);
    } catch (error) {
      if (ctx && ctx.waitUntil) ctx.waitUntil(recordQuestionAnalytics(env, {
        intent,
        cacheHit: false,
        aiUsed: true,
        responseMs: Date.now() - requestStartedAt
      }));
      trackDaily(ctx, env, { kind: 'research', intent, cacheHit: false, aiUsed: true, error: true, responseMs: Date.now() - requestStartedAt });
      return json({ ...staticFallback(goal, products, ingredients), mode: `fallback_${provider}_error`, error: 'AI provider unavailable; static educational fallback used.' }, 200, allowOrigin);
    }
  }
};
