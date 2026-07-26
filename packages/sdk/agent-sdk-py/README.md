# Phaseo Agent SDK (Python)

`phaseo-agent-sdk` is the native Python runtime for building tool-using applications on Phaseo Gateway.

It provides:

- `create_agent(...)`
- `define_tool(...)`
- `create_gateway_agent_client(...)`
- bounded and concurrent local tool execution with per-tool timeouts
- model retry/backoff, lifecycle events, and serializable run state
- human-review pauses and `continue_run(...)`
- Phaseo Devtools capture for runs and continuations

## Install

```bash
pip install phaseo phaseo-agent-sdk
```

## Quickstart

```python
from phaseo_agent import create_agent, create_gateway_agent_client

agent = create_agent({
    "id": "quickstart-agent",
    "model": "openai/gpt-5.4-nano",
    "instructions": "Answer concisely and helpfully.",
})

result = agent.run(
    input="Give me one fun fact about cURL.",
    client=create_gateway_agent_client(),
)

print(result.output)
```
