# NutraPass Common Response Cache + Privacy-Safe Question Analytics

## Purpose
Make common Research Agent searches faster without preventing AI use for nuanced questions.

## Behavior

### Fast path
For short, common, low-risk questions, the Worker can return a cached/template response without calling the AI provider.

Current common intents:
- `gut_health`
- `sleep_stress`
- `electrolytes`
- `protein`
- `creatine`
- `running_fuel`
- `beauty`
- `immune`

Examples:
- “gut health”
- “running fuel”
- “protein bars”
- “vegan collagen”
- “electrolytes”

### AI fallback remains available
The fast path is bypassed when:
- `forceAi: true` is sent
- the question is longer or nuanced
- the text mentions sensitive contexts such as pregnancy, nursing, medications, diagnosed conditions, kidney/liver/heart concerns, allergies, etc.

Those requests continue to the AI provider.

## Storage
Uses the existing Cloudflare KV binding:

`PRODUCT_CATALOG_KV`

Keys:
- Common response cache: `nutrapass:common-response:v1:<intent>`
- Question analytics: `nutrapass:question-analytics:v1:<intent>`

No additional D1 database is required yet. KV is enough for intent-level counters. If later we need detailed reporting, we can migrate this to D1.

## Analytics stored
Only privacy-safe aggregate fields are stored:

- `intent`
- `count`
- `firstSeenAt`
- `lastSeenAt`
- `activeDays`
- `avgResponseMs`
- `cacheHits`
- `aiUses`

## Analytics not stored
Do **not** store:

- raw question text
- name
- email
- IP address
- member ID
- session ID
- diagnosis/condition details
- medication text
- any personal health details

## Optional analytics summary endpoint
The Worker includes:

`GET /question-analytics`

It is disabled unless `ANALYTICS_READ_TOKEN` is configured as a Worker secret.

Set secret:

```bash
npm run secret:analytics
```

Then call with:

```bash
curl "https://nutrapass-ai.eric-012.workers.dev/question-analytics" \
  -H "X-NutraPass-Analytics-Token: <token>"
```

The endpoint returns aggregate intent rows only.

## Manual review process
Monthly or before improving templates:

1. Review top intents by count.
2. Look for low cache-hit/high AI-use intents.
3. Add or improve common templates only for safe, general questions.
4. Do not add templates for sensitive/personalized cases.
5. Keep product matching dynamic from the live Shopify catalog.

## Compliance language
Keep common responses educational:

- “supports”
- “compare”
- “educational starting point”
- “talk with a qualified professional”

Avoid:

- diagnose/treat/cure/prevent claims
- guaranteed results
- personalized medical direction
