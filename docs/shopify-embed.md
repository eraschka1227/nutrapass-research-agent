# Shopify Embed

## Recommended first integration

Embed the Cloudflare-hosted Research Agent into a Shopify page with an iframe.

```html
<iframe
  src="https://nutrapass-widget.pages.dev"
  title="NutraPass Research Agent"
  style="width:100%; min-height:900px; border:0; display:block;"
  loading="lazy"
></iframe>
```

If/when a custom domain is added, use something like:

```html
<iframe
  src="https://research.nutrapass.club"
  title="NutraPass Research Agent"
  style="width:100%; min-height:900px; border:0; display:block;"
  loading="lazy"
></iframe>
```

## Why iframe first

- Keeps AI logic outside Shopify theme files.
- Lets NutraPass update/rollback the agent independently.
- Avoids exposing API keys in browser-visible Shopify code.
- Reduces risk of the Shopify theme breaking the agent.

## Shopify page placement

Good page/nav labels:

- Research Agent
- Education Center
- Ingredient Explorer
- NutraPass Research Center

Avoid medicalized labels like “Diagnosis Tool” or “Treatment Finder.” Tiny compliance gremlin, large legal teeth.

## Later upgrades

Consider a Shopify custom app or app proxy only when the agent needs tighter integration with:

- customer accounts,
- cart actions,
- Shopify Collective product data,
- event/calendar registration,
- personalized saved histories.

Until then, iframe is the safer first ship.
