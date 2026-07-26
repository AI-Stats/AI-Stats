# Phaseo Agent SDK (Ruby)

`phaseo_agent_sdk` is the native Ruby runtime for building tool-using applications on Phaseo Gateway.

It provides:

- `PhaseoAgentSdk.create_agent`
- `PhaseoAgentSdk.define_tool`
- `PhaseoAgentSdk.create_gateway_agent_client`
- thread-based concurrent tools, timeouts, and model retry/backoff
- human-review pauses and `Agent#continue_run`
- lifecycle events, serializable run state, and Phaseo Devtools capture

## Install

```bash
gem install phaseo_sdk phaseo_agent_sdk
```
