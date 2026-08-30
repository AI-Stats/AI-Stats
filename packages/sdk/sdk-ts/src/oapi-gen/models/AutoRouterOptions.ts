/**
 * Model-selection controls used only when model is phaseo/auto. Phaseo evaluates only the explicitly allow-listed models.
 */
export interface AutoRouterOptions {
  allow_fallbacks?: boolean;
  allowed_models: string[];
  objective?: "balanced" | "quality" | "cost" | "latency";
}
