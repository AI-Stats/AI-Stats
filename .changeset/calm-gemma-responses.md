---
"@phaseo/gateway-api": patch
---

Prevent Gemma 4 thinking from exhausting short completion budgets by defaulting hosted requests to minimal thinking, explicitly accept the OpenAI-compatible `reasoning_effort` alias, correctly map explicit Gemma 4 reasoning controls, and add content-free diagnostics for empty provider responses.
