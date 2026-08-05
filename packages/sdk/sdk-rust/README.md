# Phaseo Rust SDK

The official Rust client for [Phaseo Gateway](https://phaseo.app).

## Install

```toml
[dependencies]
phaseo = "0.1"
serde_json = "1"
```

## Quick start

```rust
use phaseo::Phaseo;
use serde_json::json;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Phaseo::from_env()?;
    let response = client.responses(&json!({
        "model": "openai/gpt-5.4-nano",
        "input": "Reply with exactly: Rust SDK works"
    }))?;

    println!("{}", response.body);
    Ok(())
}
```

Set `PHASEO_API_KEY` before running the example. `PHASEO_BASE_URL` can override the default `https://api.phaseo.app/v1` endpoint.

The generated low-level client remains available under `phaseo::gen` for endpoints not yet wrapped by the ergonomic client.

## Development

```bash
rustfmt --check packages/sdk/sdk-rust/src/phaseo.rs packages/sdk/sdk-rust/tests/*.rs
cargo clippy --manifest-path packages/sdk/sdk-rust/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path packages/sdk/sdk-rust/Cargo.toml --all-targets
cargo package --manifest-path packages/sdk/sdk-rust/Cargo.toml
```

Live gateway smoke tests are opt-in with `PHASEO_RUST_LIVE_SMOKE=true`.
