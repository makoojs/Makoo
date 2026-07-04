---
"@makoojs/core": patch
---

🐛 Preserve Inferred Fallback Injection IDs

`@makoojs/core` now preserves inferred fallback injection task ids when the original base task has been destroyed.

Previously, if two different artifacts shared the same artifact name and injection target, the second artifact could receive a fallback task id. If the base task was later destroyed while the fallback task remained active, registering the second artifact again could move it back to the base id and mount the same artifact twice.

Makoo now checks for a live fallback task for the same artifact before reusing the base id, so repeated registrations continue to resolve to the existing fallback task and are correctly treated as duplicates.
