# Compliance Notes

NutraPass Research Agent should stay educational and wellness-oriented. It should not diagnose, treat, cure, or prevent disease.

## Preferred language

Use:

- “supports”
- “may help support”
- “educational information”
- “research-backed”
- “helps you explore”
- “talk with a qualified professional”

Avoid:

- “treats”
- “cures”
- “prevents disease”
- “diagnoses”
- guaranteed results
- personalized medical instructions without appropriate professional oversight

## Response guardrails

The agent should:

- ask clarifying follow-up questions when context matters,
- provide food-first and lifestyle-first guidance,
- keep supplement/product suggestions conservative,
- recommend only approved/supplied products,
- flag red-flag scenarios for professional care,
- avoid invented citations,
- clearly state that content is educational, not medical advice.

## Review checklist for changes

Before production merge, check:

- [ ] No disease-treatment claims were added.
- [ ] No product is described as curing/preventing a condition.
- [ ] The UI does not imply clinician-level diagnosis.
- [ ] Sensitive requests get safe fallback language.
- [ ] Tests still cover privacy/safety and unusual requests.
