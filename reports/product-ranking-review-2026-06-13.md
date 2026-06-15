# NutraPass Product Ranking Review — 2026-06-13

## Scope
Reviewed why Research Agent product results still feel under-dialed and why some brands are not appearing often in results.

Live surfaces checked:
- Product catalog endpoint: `https://nutrapass-ai.eric-012.workers.dev/product-catalog`
- AI Worker endpoint: `https://nutrapass-ai.eric-012.workers.dev`
- Current frontend ranking logic in `index.html`

## Catalog status
The live cached Shopify catalog is working and includes 119 products.

Brand counts:
- Silver Fern™: 53
- rawguru.com: 45
- Purishh: 8
- Cellutrex: 6
- BUILT: 4
- RNWY™: 3

This means the backend is not only importing Silver Fern and Cellutrex. The issue is ranking/relevance, not missing catalog import.

## Live query findings
Tested representative shopper queries through the same product-candidate flow used by the widget.

### Query: vegan collagen and vitamin C beauty support
Candidate brands: rawguru.com 10, Silver Fern™ 2
AI output brands: rawguru.com 5, Silver Fern™ 1
Finding: good brand representation for this query.

### Query: protein bars for workouts
Candidate brands: Purishh 2, RNWY™ 1, BUILT 3, Silver Fern™ 6
AI output brands: BUILT 3, RNWY™ 1, Purishh 1, Silver Fern™ 1
Finding: good representation when the query directly maps to bars/protein/workout language.

### Query: hydration electrolytes
Candidate brands: Cellutrex 6, rawguru.com 1, Purishh 1, Silver Fern™ 4
AI output brands: Cellutrex 4
Finding: expected; Cellutrex dominates because it has six exact electrolyte products.

### Query: chocolate protein powder
Candidate brands: Purishh 1, rawguru.com 11
AI output brands: Purishh 1, rawguru.com 5
Finding: mixed result, but chocolate snacks are competing with protein powder because “chocolate” is a strong exact match.

### Query: creatine for strength
Candidate brands: Purishh 1, Silver Fern™ 9, RNWY™ 1, rawguru.com 1
AI output brands: Purishh 1, Silver Fern™ 2, RNWY™ 1
Finding: acceptable, but Silver Fern still fills many slots because it has broad strength/body-composition metadata.

### Query: gut health probiotics prebiotics
Candidate brands: Silver Fern™ 12
AI output brands: Silver Fern™ 8
Finding: expected from current catalog. Silver Fern owns nearly all exact gut/probiotic/prebiotic products in the imported data.

### Query: sleep stress calm
Candidate brands: Silver Fern™ 12
AI output brands: Silver Fern™ 2
Finding: expected from current catalog. Other brands lack sleep/stress/calm product metadata.

### Query: energy metabolism b12
Candidate brands: Silver Fern™ 8, rawguru.com 3, Purishh 1
AI output brands: rawguru.com 1, Silver Fern™ 3
Finding: partially mixed, but Silver Fern still dominates secondary matches.

## Root causes

1. **Catalog import is working, but brand distribution is uneven.**
   Silver Fern and rawguru.com make up 98 of 119 products, so they naturally dominate many searches.

2. **Some brands have very small catalog footprints.**
   RNWY has 3 products, BUILT has 4, Cellutrex has 6, Purishh has 8. They need strong query/category matching to appear.

3. **Ranking is lexical, not truly semantic yet.**
   It matches words in product title/vendor/type/tags/description. It does not yet understand deeper intent like “quick workout snack,” “travel protein,” “clean treat,” “performance fuel,” etc. unless those words appear in Shopify metadata.

4. **Some products have sparse or generic Shopify metadata.**
   If product titles/descriptions/tags do not include shopper-language synonyms, they will lose to products with richer text.

5. **Current candidate set is relevance-only, not diversity-aware.**
   The widget sends the top 12 ranked products to AI. If one brand has most of the top exact matches, that brand fills most slots.

6. **AI can only choose from supplied candidates.**
   The Worker is correctly constrained not to invent products. If BUILT/RNWY/Purishh do not make the candidate list, the AI cannot recommend them.

## Severity
Medium product-quality issue.

The system is technically working, but the product discovery experience is not yet merchandising-grade. It will feel biased toward brands with richer metadata or larger catalogs.

## Recommended fixes

### 1. Add a product search taxonomy layer
Create controlled keywords for each product/brand:
- shopper goals
- use cases
- product form
- diet attributes
- flavor terms
- category synonyms
- when-to-use moments

Examples:
- BUILT: protein bar, snack, workout snack, sweet tooth, high protein treat, travel snack, lunchbox, dessert alternative
- RNWY: running fuel, endurance, protein, salty carbs, race day, workout recovery
- Purishh: creatine, shilajit, protein powder, performance, strength, recovery, sun balm, hair care
- rawguru.com: vegan collagen, vitamin C, chocolate, functional food, beauty, plant-based, superfood
- Cellutrex: electrolytes, hydration, sweating, travel, low sugar, workout hydration
- Silver Fern: gut, probiotics, prebiotics, stress, motility, digestive support, fiber

### 2. Diversify top candidates before sending to AI
Keep relevance first, but prevent one brand from occupying the whole candidate pool unless it is clearly the only relevant brand.

Suggested rule:
- First pass: rank all products by relevance.
- Second pass: reserve slots for distinct brands with scores above a minimum threshold.
- Then fill remaining slots by pure score.

### 3. Increase candidate pool from 12 to 18–24
AI performs better if it sees enough alternatives. Keep rendered product cards to 4–8, but send more candidate options to the Worker.

### 4. Add product category tests by brand
Create regression tests that verify likely queries surface the intended brands:
- “protein bars for workouts” includes BUILT
- “running fuel or salty carbs” includes RNWY
- “creatine for strength” includes Purishh
- “vegan collagen vitamin C” includes rawguru.com
- “hydration electrolytes” includes Cellutrex
- “gut prebiotic probiotic” includes Silver Fern

### 5. Improve Shopify product metadata
Add strong tags/descriptions/metafields in Shopify. The ranking can only use what exists.

Best fields to improve:
- product title
- product type
- tags
- description
- eventually custom metafields like `nutrapass_goal_keywords`, `nutrapass_use_cases`, `nutrapass_diet_tags`

## Bottom line
The import is working and all brands are in the catalog. The results are not fully dialed in because ranking is still too literal and not diversity-aware. The next real upgrade is not another import fix; it is a better product relevance layer plus brand-diversified candidate selection.
