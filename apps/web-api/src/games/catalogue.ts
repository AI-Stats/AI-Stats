import type { Env } from "@/env";
import { fetchModelsPageCatalogue } from "@/models/page-catalogue";
import { listGameCatalogueModels } from "./repository";
import type { GameModel, ModelAccess } from "./types";

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map(text).filter(Boolean))].sort()
    : [];
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function object(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function modelAccess(license: unknown, metadataValue: unknown): ModelAccess {
  const metadata = object(metadataValue);
  const normalized = text(license).toLowerCase();
  if (/\b(apache|mit|bsd|mpl|gpl|agpl|lgpl|cc[- ]by)\b/.test(normalized)) {
    return "open_source";
  }
  if (metadata.open_weights === true || metadata.openWeights === true) {
    return "open_weights";
  }
  if (!normalized) return "unknown";
  if (/proprietary|commercial|closed|terms of use|custom/.test(normalized)) {
    return "proprietary";
  }
  return "unknown";
}

function releaseDate(row: Row, pageRow: Row): string | null {
  const value = text(
    row.released_at || row.announced_at || pageRow.primary_date
  );
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 10)
    : null;
}

function relationRow(value: unknown): Row {
  if (Array.isArray(value)) return object(value[0]);
  return object(value);
}

export async function fetchGameCatalogue(env: Env): Promise<GameModel[]> {
  const [page, modelsResult] = await Promise.all([
    fetchModelsPageCatalogue(env),
    listGameCatalogueModels(env),
  ]);

  const pageById = new Map(page.models.map((row) => [text(row.model_id), row]));
  return modelsResult
    .flatMap((source) => {
      const row = source as Row;
      const id = text(row.model_slug);
      const name = text(row.name);
      const pageRow = pageById.get(id) ?? {};
      const lab = relationRow(row.lab);
      const released = releaseDate(row, pageRow);
      if (!id || !name || id === "phaseo/free") return [];
      return [
        {
          id,
          name,
          labSlug: text(row.lab_slug),
          labName:
            text(lab.name || pageRow.organisation_name || row.lab_slug) ||
            "Unknown",
          countryCode: text(lab.country_code).toUpperCase() || null,
          releaseDate: released,
          releaseYear: released ? Number(released.slice(0, 4)) : null,
          access: modelAccess(row.license, row.metadata),
          inputModalities:
            stringList(row.input_modalities).length > 0
              ? stringList(row.input_modalities)
              : stringList(pageRow.gateway_input_modalities),
          outputModalities:
            stringList(row.output_modalities).length > 0
              ? stringList(row.output_modalities)
              : stringList(pageRow.gateway_output_modalities),
          providerCount: finiteNumber(pageRow.gateway_active_provider_count),
          contextLength:
            Math.max(
              ...stringList(pageRow.context_lengths)
                .map(Number)
                .filter(Number.isFinite),
              0
            ) || null,
          inputPrice: finiteNumber(pageRow.lowest_standard_input_price),
          outputPrice: finiteNumber(pageRow.lowest_standard_output_price),
          priceUnit:
            text(
              pageRow.lowest_standard_input_price_unit ||
                pageRow.lowest_standard_output_price_unit
            ) || null,
          family: text(row.family_slug) || null,
        } satisfies GameModel,
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
