// Cloudflare Worker prototype for NutraPass AI-assisted educational responses.
// Deploy with OPENAI_API_KEY stored as a Worker secret — never expose it in the HTML page.
// Example: wrangler secret put OPENAI_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const privacyHeaders = {
  ...corsHeaders,
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Expires': '0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

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

const SYSTEM_PROMPT = `You are NutraPass's educational wellness research assistant.

You write concise, practical, consumer-friendly educational wellness responses.
You are not medical advice. You do not diagnose, treat, cure, mitigate, or prevent any disease.
Use structure/function language only: "supports", "may be associated with", "may be influenced by", "compare options".
Do not say supplements relieve, treat, cure, fix, prevent, reverse, or heal any disease or symptom.
Do not invent NutraPass products. Recommend only products supplied in the request or in the approved catalog.
Do not invent citations. If a PubMed ID is supplied, you may include it. Otherwise omit citations.
Include food-first and lifestyle-first guidance before supplements.
For the Health Overview, infer a specific wellness pattern from the user's wording (digestive bloating vs reflux vs constipation vs sleep/stress vs fatigue/iron-status vs immune vs performance vs beauty). Explain what may be going on in plain language. Do not use the old causes-style heading and do not use generic filler unless the user gives no usable detail. If the user's wording is vague, ask them to identify the main pattern instead of pretending to know.
Never tell the user their question does not match a category. Never expose internal routing, category matching, or classification logic. If the user gives no usable wellness detail, ask one short clarifying question instead of producing a broad wellness overview. If the user gives even one clue, choose the closest wellness pattern and write a specific Health Overview using plain language. Avoid generic lists such as "meal quality, protein, fiber, hydration, sleep, stress, movement, nutrient gaps" unless those items are directly tied to the user's stated goal.
Include a stronger professional-care note for red flags such as severe pain, swelling, one-sided calf pain, warmth, chest pain, shortness of breath, numbness, sudden weakness, pregnancy/nursing, kidney disease, blood thinners, or persistent/worsening symptoms.
Ingredient Research Notes requirements:
- Return 10–12 ingredient notes whenever enough approved ingredients are supplied.
- Rank notes by likely relevance to the user's wording.
- The first 4–6 notes are shown under the Top Matches section.
- The remaining 4–6 notes are shown under Additional Options to Compare, including secondary or situation-dependent options when appropriate.
- Do not repeat "Top Match" or "Additional Option to Compare" inside each ingredient note's bestFit text; the section heading already carries that ranking.
- Each researchContext should be a 2–3 sentence research context, not a generic one-liner.
- Do not imply the user should take every ingredient; frame them as comparison options.
- Ingredient notes must be nutrients, botanicals, compounds, or honest blend categories — not NutraPass product names. For example, Joint Complex is a product/blend category, not an ingredient; if relevant, write about joint-support nutrients such as collagen peptides, omega-3s, turmeric/curcumin, glucosamine/chondroitin/MSM category comparisons, or minerals rather than naming Joint Complex as an ingredient.

Return strict JSON only with this shape:
{
  "summary": "one short paragraph",
  "nutritionOverview": "What may be going on: issue-specific Health Overview explanation of the user's likely wellness pattern; avoid generic filler and do not use the old causes-style heading.\n\nFood first: ...\n\nEasy things to try: ...\n\nNutrition options to compare: ...\n\nUse supplements as optional add-ons...",
  "ingredientNotes": [
    {"name":"Magnesium","bestFit":"Normal muscle function and relaxation-routine support","researchContext":"2–3 sentence research context...","typicalRange":"...","pubmedId":""},
    {"name":"Omega-3s","bestFit":"Secondary inflammatory-balance and heart-health comparison","researchContext":"2–3 sentence research context...","typicalRange":"...","pubmedId":""}
  ],
  "products": [
    {"name":"H2O Electrolytes","brand":"Cellutrex","imageUrl":"","why":"..."},
    {"name":"Stress Complex","brand":"Silver Fern","imageUrl":"","why":"..."}
  ]
}`;

const CLINICAL_LOOKUP_PROMPT = `You are NutraPass's clinical nutrition literature lookup assistant.

The user will provide one vitamin, mineral, herb, amino acid, botanical, or supplement ingredient. Write an educational research summary only. Do not diagnose, treat, cure, mitigate, prevent, reverse, fix, or heal any disease. Do not recommend that the user take the ingredient. Use language such as "studied for", "researched in", "may be associated with", "compare", and "review safety".

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

Answer the shopper's follow-up question using the original NutraPass report context supplied in the request. Be warm, kind, and helpful — like a calm nutrition guide, not a clinician. Do not replace or rewrite the original report unless directly asked.

Keep the answer tight: 55–110 words, 2 short paragraphs max, or 3 short bullets max. Avoid wall-of-text responses, markdown bolding, long numbered lists, and overly medical phrasing. Use plain-language structure/function wording only. Do not diagnose, treat, cure, mitigate, prevent, reverse, fix, or heal any disease or symptom. Do not invent NutraPass products. Use only the products and ingredient notes supplied in the request. Include food-first or practical next-step guidance when useful.

If the shopper asks about a product, brand, or supplement that is not in the supplied NutraPass products, do not force a NutraPass product. Give practical quality/clear-label guidance instead: look for a transparent Supplement Facts panel, exact ingredient forms and amounts, third-party testing or cGMP quality cues, minimal proprietary blends, allergen/sweetener clarity, and serving-size math that matches the research context. Return an empty products array unless a supplied product is directly relevant.

Safety notes should be brief and gentle: mention professional care only for red flags, pregnancy/nursing, medications, kidney disease, blood thinners, severe symptoms, or persistent/worsening concerns. If one missing detail would materially improve the answer, ask at most one short gap-filling question in the gaps array. Leave gaps empty when the answer is already clear.
Never tell the shopper their question does not match a category. Never expose internal routing, category matching, or classification logic. If the follow-up gives no usable wellness detail, ask one short clarifying question instead of producing a broad wellness overview. Avoid generic lists such as "meal quality, protein, fiber, hydration, sleep, stress, movement, nutrient gaps" unless those items are directly tied to the shopper's stated goal.

Return strict JSON only with this shape:
{
  "answer": "warm, concise answer in 55-110 words; no markdown bolding; no long numbered lists",
  "gaps": ["optional single concise question to fill an important gap"],
  "products": [
    {"name":"Existing product from supplied report only","brand":"Silver Fern","imageUrl":"","why":"why it remains relevant to this follow-up"}
  ]
}`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...privacyHeaders, 'Content-Type': 'application/json' },
  });
}

function healthPage() {
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
    headers: { ...privacyHeaders, 'Content-Type': 'text/html; charset=UTF-8' },
  });
}

function safeParseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

function staticFallback(goal, products = [], ingredients = []) {
  const g = String(goal || '').toLowerCase();
  const has = (re) => re.test(g);
  const pica = has(/\b(ice|dirt|clay|chalk|laundry starch|cornstarch|pica)\b/) && has(/\b(crav|chew|eat|mouth|gnaw)\w*/);
  const reflux = has(/reflux|acid|heartburn|gerd|burning|indigestion|burp/);
  const bloat = has(/bloat|bloated|gas|fodmap|ibs|distend/);
  const constipation = has(/constipat|regularity|bowel|motility|poop|stool/);
  const sleepStress = has(/sleep|insomnia|stress|anxiety|burnout|worry|cortisol|tired|fatigue/);
  const immune = has(/immune|cold|flu|sick|sinus|seasonal/);
  const performance = !pica && has(/strength|muscle|body|composition|weight|metabolism|workout|cramp|calf|sore|recovery|leg/);
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
  if (pica) key = 'pica'; else if (reflux) key = 'reflux'; else if (bloat) key = 'bloat'; else if (constipation) key = 'constipation'; else if (sleepStress) key = 'sleepStress'; else if (immune) key = 'immune'; else if (performance) key = 'performance'; else if (beauty) key = 'beauty';

  const normalizeSuppliedIngredient = (i, idx) => {
    const rawName = i.name || i.nm || `Ingredient ${idx + 1}`;
    const name = /^joint complex$/i.test(String(rawName || '').trim()) ? 'Joint support nutrients' : rawName;
    const rawBestFit = i.bestFit || i.b || (idx < 6 ? 'educational research fit' : 'secondary educational research fit');
    return {
      name,
      bestFit: String(rawBestFit || '').replace(/^(Top Match|Additional Option to Compare):\s*/i, ''),
      researchContext: i.researchContext || i.detail || 'Compare ingredient form, dose, product quality, and personal context before use. Use this as an educational research starting point, not a recommendation to take every listed ingredient.',
      typicalRange: i.typicalRange || i.dose || 'Follow label directions and professional guidance.',
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
    .slice(0, 12);
  const suppliedProducts = (products || []).slice(0, 4).map(p => ({ name: p.name, brand: productBrand(p.name, p.brand), imageUrl: p.imageUrl || '', why: p.why || 'Closest product fit from the NutraPass catalog' }));
  const productMap = {
    pica: [{ name: 'Ultimate Wellness Bundle', why: 'Broad daily wellness comparison only; prioritize clinician-guided iron-status evaluation before supplement choices' }, { name: 'Stress Complex', why: 'Sleep and shift-work routine support comparison' }],
    reflux: [{ name: 'Upper GI Relief', why: 'Upper digestive comfort comparison' }, { name: 'Reflux Plus Kit', why: 'Acid/reflux support kit comparison' }, { name: 'Digestive Enzyme', why: 'Meal-time digestion support comparison' }],
    bloat: [{ name: 'Bloat Relief Kit', why: 'Bloat and gas support comparison' }, { name: 'Bloat & Gas Relief', why: 'FODMAP-related comfort comparison' }, { name: 'Complete Biotic Kit', why: 'Microbiome support comparison' }],
    constipation: [{ name: 'Motility - Constipation Support', why: 'Non-laxative motility support comparison' }, { name: 'Regularity', why: 'Regularity support comparison' }, { name: 'Ultimate Fiber', why: 'Prebiotic fiber comparison' }],
    sleepStress: [{ name: 'Stress Complex', why: 'Calm and sleep routine support comparison' }, { name: 'The Burnout Kit', why: 'Stress and fatigue stack comparison' }],
    immune: [{ name: 'Immune+ Protocol', why: 'Immune system support comparison' }, { name: 'Postbiotic+', why: 'Gut and immune support comparison' }, { name: 'Whole Food Multivitamin', why: 'Daily vitamin/mineral foundation comparison' }],
    performance: [{ name: 'H2O Electrolytes', why: 'Hydration and electrolyte balance support' }, { name: 'Build - Strength & Muscle', why: 'Training and recovery routine support' }, { name: 'Build Up Protocol', why: 'Stack for build goals comparison' }],
    beauty: [{ name: 'Hair Skin & Nails', why: 'Beauty-from-within support comparison' }, { name: 'Hair Complex - Keratin & Silica', why: 'Hair strength nutrient comparison' }]
  };
  const chosenProducts = (productMap[key] || suppliedProducts).map(p => ({
    ...p,
    brand: productBrand(p.name, p.brand),
    imageUrl: p.imageUrl || ''
  }));

  const overviewMap = {
    pica: 'What may be going on: craving ice or non-food items plus restless legs can sometimes overlap with iron-status questions, low ferritin, B-vitamin status, sleep disruption, stress load, pregnancy, heavy menstrual bleeding, or absorption issues. This is worth lab-based follow-up rather than guessing from symptoms alone.\n\nFood first: compare iron-containing foods such as lean meats, seafood, beans, lentils, tofu, spinach, pumpkin seeds, and fortified foods; pair plant iron with vitamin C-rich foods like citrus, berries, kiwi, bell pepper, or broccoli.\n\nEasy things to try: track when cravings or restless-leg sensations happen, note energy, dizziness, shortness of breath, menstrual/blood-loss context, caffeine timing, and sleep schedule, then ask a clinician about CBC, ferritin, and iron studies if it persists.\n\nNutrition options to compare: iron status labs, vitamin C with meals, B12/folate status, magnesium for normal muscle relaxation, hydration, and protein adequacy. Do not start high-dose iron without blood work and professional guidance because excess iron can be unsafe.\n\nSupplements should be optional add-ons, not substitutes for food, sleep, movement, or medical care.',
    reflux: 'What may be going on: upper-digestive discomfort can be influenced by meal size, eating pace, late-night meals, higher-fat meals, caffeine/alcohol, spicy or acidic foods, mint/chocolate triggers, stress, and individual tolerance patterns. Burning, chest discomfort, trouble swallowing, vomiting blood, or unexplained weight loss should be handled medically.\n\nFood first: try smaller balanced meals, lower-fat evening meals, oatmeal, bananas, lean proteins, cooked vegetables, and non-mint herbal tea if tolerated.\n\nEasy things to try: avoid lying down right after eating, leave 2–3 hours before bed, slow down meals, and track triggers such as coffee, alcohol, chocolate, mint, spicy foods, and large late meals.\n\nNutrition options to compare: digestive enzymes for meal-time support, ginger only if tolerated, and upper-GI/reflux-focused products. Avoid anything that worsens burning or nausea.\n\nSupplements should be optional add-ons, not substitutes for food, sleep, movement, or medical care.',
    bloat: 'What may be going on: bloating and gas patterns can be influenced by how quickly meals are eaten, fermentable carbohydrates/FODMAP load, constipation or slow transit, microbiome shifts, fiber changes, carbonated drinks, stress, and food tolerance.\n\nFood first: use simple tolerated foods while observing patterns: oats, rice/potatoes, lean protein, cooked vegetables, kiwi, yogurt/kefir if tolerated, and adequate fluids. Increase beans, cruciferous vegetables, and high-fiber foods gradually.\n\nEasy things to try: walk 5–10 minutes after meals, eat slower, keep a food/symptom log, avoid changing several foods or supplements at once, and notice whether symptoms track with dairy, wheat, onions/garlic, carbonated drinks, or large portions.\n\nNutrition options to compare: digestive enzymes, probiotics/postbiotics, gentle prebiotic fiber, peppermint oil only if reflux is not an issue, and bloat/FODMAP-focused products.\n\nSupplements should be optional add-ons, not substitutes for food, sleep, movement, or medical care.',
    constipation: 'What may be going on: regularity issues can be influenced by fluid intake, fiber type, low food volume, travel, schedule changes, inactivity, stress, medications, magnesium intake, and normal motility patterns.\n\nFood first: compare kiwi, prunes, oats, chia/flax, beans/lentils as tolerated, cooked vegetables, enough fluids, and regular meals rather than skipping food all day.\n\nEasy things to try: build a consistent morning routine, walk daily, increase fiber gradually, pair fiber with water, and track whether travel, stress, or low meal volume changes bowel patterns.\n\nNutrition options to compare: prebiotic fiber, magnesium forms that support regularity, probiotics/postbiotics, and motility/regularity products. Add slowly to avoid making gas or bloating worse.\n\nSupplements should be optional add-ons, not substitutes for food, sleep, movement, or medical care.',
    sleepStress: 'What may be going on: sleep, stress, and low-energy patterns can be influenced by caffeine timing, inconsistent sleep/wake rhythm, evening light exposure, high stress load, under-eating, low protein, low magnesium intake, overtraining, alcohol, and mood or thyroid/iron/B12 issues.\n\nFood first: include protein at meals, magnesium-rich foods such as pumpkin seeds/spinach/beans, complex carbs at dinner if tolerated, steady hydration, and lower caffeine intake after late morning or early afternoon.\n\nEasy things to try: set a consistent wind-down time, dim screens/lights before bed, get morning daylight, keep workouts earlier if they feel stimulating, and use breathing or a short walk to downshift stress.\n\nNutrition options to compare: magnesium, L-theanine, melatonin for timing-focused sleep needs, stress-support blends such as ashwagandha, plus iron/B12/folate status if fatigue is prominent.\n\nSupplements should be optional add-ons, not substitutes for food, sleep, movement, or medical care.',
    immune: 'What may be going on: immune-support needs are often shaped by sleep quality, stress load, vitamin D status, protein intake, gut health, hydration, seasonal exposure, and overall diet quality. Frequent, severe, or prolonged infections should be discussed with a clinician.\n\nFood first: focus on colorful fruits/vegetables, citrus or berries, protein with each meal, zinc foods like seafood/meat/pumpkin seeds, fermented foods, and steady hydration.\n\nEasy things to try: prioritize sleep, wash hands, keep workouts moderate when run down, get daylight, and avoid megadosing single nutrients for long periods.\n\nNutrition options to compare: vitamin D3, zinc, vitamin C, probiotics/postbiotics, and a multivitamin if diet gaps are likely. Compare dose limits and avoid duplicating nutrients across products.\n\nSupplements should be optional add-ons, not substitutes for food, sleep, movement, or medical care.',
    performance: 'What may be going on: body-composition, cramping, soreness, and performance goals can be influenced by protein distribution, training progression, hydration/electrolytes, sleep, total energy intake, magnesium status, and recovery time. Sudden one-sided calf pain, swelling, warmth, chest pain, or shortness of breath should be treated as urgent.\n\nFood first: build protein-forward meals, high-fiber carbs around activity, fruits/vegetables, and fluids with electrolytes when sweating.\n\nEasy things to try: lift consistently, walk daily, plan protein at breakfast, stretch or mobilize tight areas gently, sleep enough for recovery, and track progress with strength/energy/waist or fit rather than day-to-day scale noise only.\n\nNutrition options to compare: protein, creatine, electrolytes, magnesium, omega-3s, and metabolism/body-composition products.\n\nSupplements should be optional add-ons, not substitutes for food, sleep, movement, or medical care.',
    beauty: 'What may be going on: hair, skin, and nail changes can be influenced by protein intake, iron/zinc status, essential fatty acids, thyroid or hormone changes, stress load, biotin status, collagen support, skin barrier habits, and normal growth cycles. Sudden hair loss, brittle nails, or major skin changes should be evaluated.\n\nFood first: prioritize adequate protein, vitamin-C foods, eggs/fish/lean meats or legumes, nuts/seeds, colorful produce, omega-3-rich foods, and enough calories overall.\n\nEasy things to try: be consistent for 8–12+ weeks, avoid crash dieting, protect sleep, simplify harsh skin/hair routines, and consider labs if changes are sudden or persistent.\n\nNutrition options to compare: collagen peptides, biotin, zinc, omega-3s, hair/skin/nail blends, and mineral-containing multis. Avoid assuming more is better; high-dose biotin can interfere with some lab tests.\n\nSupplements should be optional add-ons, not substitutes for food, sleep, movement, or medical care.'
  };

  return {
    summary: key === 'general' ? 'I can help narrow this into a more useful NutraPass research summary with one quick direction.' : `I’m reading this as a ${key.replace('sleepStress', 'sleep/stress').replace('pica', 'iron-status / unusual-craving')} support question, so the overview is tailored to that pattern.`,
    nutritionOverview: overviewMap[key] || 'What may be going on: what is the main thing you want help comparing right now — digestion, energy, sleep/stress, body composition, immunity, or hair/skin/nails? With that direction, NutraPass can give a more specific food-first overview and ingredient comparison instead of guessing.\n\nFood first: once the main pattern is clear, start with the simplest meal or routine lever connected to that goal.\n\nEasy things to try: pick one focus area, note timing and triggers for a few days, and avoid adding multiple supplements at once.\n\nNutrition options to compare: compare ingredient form, serving size, cautions, and product overlap after the goal is clearer.\n\nSupplements should be optional add-ons, not substitutes for food, sleep, movement, or medical care.',
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

function asksAboutOffCatalogProduct(question) {
  const q = String(question || '').toLowerCase();
  return /not on nutrapass|not available|outside nutrapass|what about|which brand|brand|label|supplement facts|proprietary blend/.test(q);
}

function staticFollowUpFallback(question, report = {}) {
  const asksOutsideProduct = asksAboutOffCatalogProduct(question);
  const products = asksOutsideProduct ? [] : (Array.isArray(report.products) ? report.products.slice(0, 2) : []);
  const ingredients = Array.isArray(report.ingredients) ? report.ingredients.slice(0, 4).map(i => i.name || i.nm).filter(Boolean) : [];
  const ingredientText = ingredients.length ? ` The original report's strongest comparison areas include ${ingredients.join(', ')}.` : '';
  const qualityText = ' If the exact product is not on NutraPass, look for a clear Supplement Facts panel, named ingredient forms and amounts, third-party testing or cGMP quality cues, low reliance on proprietary blends, allergen/sweetener clarity, and serving-size math that matches the research context.';
  return {
    answer: asksOutsideProduct
      ? `Use the original report as your ingredient checklist, then judge the outside product by label quality rather than marketing claims.${qualityText} Avoid stacking it with similar formulas until you compare overlap and tolerance.`
      : `Based on the original NutraPass report, use this follow-up as a refinement step rather than starting over.${ingredientText} Track the specific timing, food triggers, medications, and tolerance details behind your question, then compare the report's ingredients and related products against those details. Keep food, sleep, hydration, and routine changes as the foundation.`,
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
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: privacyHeaders });
    if (request.method === 'GET' || request.method === 'HEAD') return healthPage();
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON body' }, 400); }

    const clinicalLookup = String(body.clinicalLookup || body.lookupIngredient || '').slice(0, 160);
    if (clinicalLookup.trim()) {
      const lookupPayload = {
        ingredient: clinicalLookup,
        requiredDisclaimer: 'Educational information only; not medical advice; not intended to diagnose, treat, cure, or prevent any disease.',
        linkPreference: 'Return durable research/search links only. Do not invent PubMed IDs.'
      };
      const provider = selectAiProvider(body, env);
      if (provider === 'fallback') return json(staticClinicalLookupFallback(clinicalLookup));
      try {
        const content = provider === 'claude'
          ? await callClaudeClinicalLookup(env, lookupPayload)
          : await callOpenAiClinicalLookup(env, lookupPayload);
        const parsed = safeParseJson(content);
        return json({ ...parsed, mode: provider === 'claude' ? 'claude' : 'openai', type: 'clinicalLookup' });
      } catch (error) {
        return json({ ...staticClinicalLookupFallback(clinicalLookup), mode: `fallback_${provider}_clinical_error`, error: 'AI provider unavailable; static clinical lookup fallback used.' });
      }
    }

    const followUpQuestion = String(body.followUpQuestion || body.followup || body.question || '').slice(0, 700);
    if (followUpQuestion.trim()) {
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
        return json({ ...staticFollowUpFallback(followUpQuestion, report), mode: 'fallback_no_ai_key', type: 'followup' });
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
        return json({ ...parsed, mode: provider === 'claude' ? 'claude' : 'openai', type: 'followup' });
      } catch (error) {
        return json({ ...staticFollowUpFallback(followUpQuestion, report), mode: `fallback_${provider}_error`, type: 'followup', error: 'AI provider unavailable; static educational fallback used.' });
      }
    }

    const goal = String(body.goal || '').slice(0, 800);
    const products = Array.isArray(body.products) ? body.products.slice(0, 8) : [];
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients.slice(0, 20) : [];
    if (!goal.trim()) return json({ error: 'Missing goal' }, 400);

    const userPayload = {
      userQuestion: goal,
      approvedProductsFromPage: products,
      approvedIngredientsFromPage: ingredients,
      approvedProductCatalog: PRODUCT_CATALOG,
      requiredDisclaimer: 'Educational information only; not medical advice; not intended to diagnose, treat, cure, or prevent any disease.'
    };

    const provider = selectAiProvider(body, env);
    if (provider === 'fallback') {
      return json({ ...staticFallback(goal, products, ingredients), mode: 'fallback_no_ai_key' });
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
      return json({ ...parsed, mode: provider === 'claude' ? 'claude' : 'openai' });
    } catch (error) {
      return json({ ...staticFallback(goal, products, ingredients), mode: `fallback_${provider}_error`, error: 'AI provider unavailable; static educational fallback used.' });
    }
  }
};
