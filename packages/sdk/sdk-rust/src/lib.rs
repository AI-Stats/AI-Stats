#![forbid(unsafe_code)]

#[allow(non_snake_case, unused_imports, unused_variables)]
#[path = "gen/lib.rs"]
pub mod gen;
#[allow(clippy::module_inception, rustdoc::bare_urls)]
pub mod model_ids;
mod phaseo;

pub use phaseo::{Phaseo, PhaseoError, PhaseoResponse};

pub mod client {
    pub use crate::gen::client::*;
}

pub mod models {
    pub use crate::gen::models::*;
}

pub mod operations {
    pub use crate::gen::operations::*;
}
