# Phaseo Agent SDK (Go)

`agent-sdk-go` is the native Go runtime for building tool-using applications on Phaseo Gateway.

It provides:

- `CreateAgent(...)`
- `DefineTool(...)`
- `CreateGatewayAgentClient(...)`
- concurrent local tools, contexts, timeouts, and model retry/backoff
- human-review pauses and `Agent.Continue(...)`
- lifecycle events, serializable run state, and Phaseo Devtools capture

## Install

```bash
go get github.com/phaseoteam/Phaseo/packages/sdk/agent-sdk-go@latest
```
