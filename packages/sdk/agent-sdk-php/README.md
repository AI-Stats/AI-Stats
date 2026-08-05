# Phaseo Agent SDK (PHP)

`phaseo/agent-sdk` is the native PHP runtime for building tool-using applications on Phaseo Gateway.

It provides:

- `AgentSdk::createAgent(...)`
- `AgentSdk::defineTool(...)`
- `AgentSdk::createGatewayAgentClient(...)`
- bounded local tools, timeout checks, and model retry/backoff
- human-review pauses and `Agent::continueRun(...)`
- lifecycle events, serializable run state, and Phaseo Devtools capture

## Install

```bash
composer require phaseo/sdk phaseo/agent-sdk
```

## Quickstart

```php
<?php
require "vendor/autoload.php";

use Phaseo\AgentSdk\AgentDefinition;
use Phaseo\AgentSdk\AgentSdk;

$agent = AgentSdk::createAgent(new AgentDefinition(
    id: "quickstart-agent",
    model: "openai/gpt-5.4-nano",
    instructions: "Answer concisely and helpfully."
));

$result = $agent->run(
    input: "Give me one fun fact about cURL.",
    client: AgentSdk::createGatewayAgentClient()
);

echo $result->output . PHP_EOL;
```
