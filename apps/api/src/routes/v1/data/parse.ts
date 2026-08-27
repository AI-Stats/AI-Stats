// Purpose: Data-plane route handler for document parsing requests.
// Why: Preserves structured document output that cannot fit the OCR response.
// How: Wires the public Parse contract into the shared non-text pipeline.

import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { ParseSchema } from "@core/schemas";
import { makeEndpointHandler } from "@pipeline/index";
import { withRuntime } from "../../utils";

const parseHandler = makeEndpointHandler({ endpoint: "parse", schema: ParseSchema });

export const parseRoutes = new Hono<Env>();

parseRoutes.post("/", withRuntime(parseHandler));
