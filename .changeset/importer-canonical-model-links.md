---
"@phaseo/web": patch
---

Canonicalize model slugs when importing model links, details, and page notices so aliased canonical ids no longer produce orphaned child rows that violate foreign keys during import.
