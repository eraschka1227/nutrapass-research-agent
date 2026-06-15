# NutraPass Research Agent UI Version Tracker

Use this file as the lightweight source of truth for visible UI changes so we can spot accidental regressions before deploy.

## v0.3.0 — Notice-card contrast guardrails

Date: 2026-06-15

Status: local change pending review/deploy.

### Visual contract

- Alpha testing banner uses a visible citrus/yellow interior wash, not a flat white or pale green card.
- Privacy and Safety boxes use a pastel-green differentiated background with a left accent border.
- Legal/privacy copy uses dark charcoal/green text (`#243028`, `#1f6f43`) rather than pale mint.
- Input section labels use dark green (`#31513c`), not pale mint, for readability.

### Regression coverage

- `tests/privacy_safety_test.js` checks the alpha banner background, privacy/legal box background separation, and dark label/emphasis text.

### Deploy note

- Do not deploy this visual contract until reviewed/approved in the browser preview.

## v0.2.x — Research Agent prompt / answer formatting

- Original wellness answers should include a short Health Overview beginning with “What may be going on,” plus “Food first” and “Easy things to try.”
- Clinically backed ingredients come first; traditional/alternative options can be included when clearly labeled as traditional, emerging, mixed-evidence, or situation-dependent.

## v0.1.x — Initial public widget

- Research Agent widget shell, privacy/safety language, clinical lookup, product cards, and Cloudflare Worker integration.
