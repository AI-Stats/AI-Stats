# Phaseo Agent SDK (C#)

`Phaseo.AgentSdk` is the native .NET runtime for building tool-using applications on Phaseo Gateway.

It provides:

- `AgentSdk.CreateAgent(...)`
- `AgentSdk.DefineTool(...)`
- `AgentSdk.CreateGatewayAgentClient(...)`
- task-based concurrent tools, cancellation, timeouts, and model retry/backoff
- human-review pauses and `Agent.ContinueRun(...)`
- lifecycle events, serializable run state, and Phaseo Devtools capture

## Install

```bash
dotnet add package Phaseo.Sdk
dotnet add package Phaseo.AgentSdk
```

## Quickstart

```csharp
using PhaseoAgentSdk;

var agent = AgentSdk.CreateAgent(new AgentDefinition
{
    Id = "quickstart-agent",
    Model = "openai/gpt-5.4-nano",
    Instructions = "Answer concisely and helpfully."
});

var result = await agent.Run(new RunOptions
{
    Input = "Give me one fun fact about cURL.",
    Client = AgentSdk.CreateGatewayAgentClient(),
});

Console.WriteLine(result.Output);
```
