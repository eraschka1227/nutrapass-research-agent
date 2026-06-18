# Simplero → Shopify automation

Purpose: when Simplero says a person is approved or subscribed, the Worker creates/updates the Shopify customer and adds customer tags.

## Webhook URL

Use this in Simplero outgoing webhooks after the Worker is deployed:

```text
https://nutrapass-ai.eric-012.workers.dev/simplero-webhook?action=approved&secret=YOUR_SECRET
```

For a paid/subscribed member:

```text
https://nutrapass-ai.eric-012.workers.dev/simplero-webhook?action=subscribed&secret=YOUR_SECRET
```

## Shopify tags added

- `action=approved` → `nutrapass`, `approved`
- `action=subscribed` → `nutrapass`, `approved`, `member`, `active`
- unknown action → defaults to `nutrapass`, `approved`

## Required Worker secrets

```bash
npm run secret:simplero-webhook
npm run secret:shopify-admin
```

`SIMPLERO_WEBHOOK_SECRET` is any long random password we choose.

`SHOPIFY_ADMIN_ACCESS_TOKEN` must come from a Shopify custom app with customer read/write access.

## Shopify custom app permissions

Minimum Admin API scopes:

```text
read_customers
write_customers
```

## Notes

Simplero payload shapes vary. The Worker searches the webhook JSON for common fields like `email`, `first_name`, `last_name`, `name`, and `tags`.

Keep the secret out of screenshots if possible. If it leaks, rotate `SIMPLERO_WEBHOOK_SECRET` and update Simplero.
