# Phaseo Agent SDK for Rust

Build tool-using agents on [Phaseo Gateway](https://phaseo.app) with native Rust types.

## Install

```toml
[dependencies]
phaseo = "0.1"
phaseo-agent = "0.1"
serde_json = "1"
```

## Quick start

```rust
use phaseo_agent::{
    create_agent, create_gateway_agent_client, define_tool, AgentDefinition,
    RunOptions, Tool,
};
use serde_json::json;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let lookup = define_tool(Tool::new(
        "lookup",
        "Look up a Phaseo documentation topic",
        json!({
            "type": "object",
            "properties": {"topic": {"type": "string"}},
            "required": ["topic"]
        }),
        |input, _context| Ok(json!({"topic": input["topic"], "found": true})),
    ));

    let agent = create_agent(
        AgentDefinition::new("docs-agent", "openai/gpt-5.4-nano")
            .instructions("Use the lookup tool when it helps.")
            .tool(lookup),
    );
    let mut client = create_gateway_agent_client("openai/gpt-5.4-nano")?;
    let result = agent.run(&mut client, RunOptions::new("Explain routing presets"))?;

    println!("{}", result.output);
    Ok(())
}
```

Set `PHASEO_API_KEY` before running. Agent runs support model retries, local and externally fulfilled tools, approval gates, human-review pauses, resumption, lifecycle events, usage aggregation, and serializable run state.

## Development

```bash
rustfmt --check packages/sdk/agent-sdk-rust/src/lib.rs
cargo clippy --manifest-path packages/sdk/agent-sdk-rust/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path packages/sdk/agent-sdk-rust/Cargo.toml --all-targets
cargo package --manifest-path packages/sdk/agent-sdk-rust/Cargo.toml
```
