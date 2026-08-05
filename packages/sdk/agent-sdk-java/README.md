# Phaseo Agent SDK for Java

Native Java runtime for local tool loops, retries, human review, resumable run state,
lifecycle events, and Phaseo Devtools capture. It delegates model turns to the
published `app.phaseo:phaseo-sdk` client and does not provide hosted orchestration.

```java
var agent = AgentSdk.createAgent(new AgentSdk.AgentDefinition(
    "support-agent", "openai/gpt-5.4-nano", null, "Use tools when useful.",
    List.of(), 12, null, null, null, null
));
var result = agent.run(new AgentSdk.RunOptions(
    "Explain presets", AgentSdk.createGatewayAgentClient(), null, null, null,
    null, null, null, null, null
));
System.out.println(result.output());
```
