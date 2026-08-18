import type { Client } from "../../runtime/client.js";

export type ConnectRealtimeSessionRelayParams = {
  path?: { session_id: string };
  query?: Record<string, never>;
  headers?: Record<string, never>;
  body?: never;
};

/** Upgrades the request to the authenticated realtime WebSocket relay. */
export async function connectRealtimeSessionRelay(client: Client, args: ConnectRealtimeSessionRelayParams = {}): Promise<unknown> {
  const { path, query, headers, body } = args;
  return client.request<unknown>({
    method: "GET",
    path: `/audio/realtime/sessions/${encodeURIComponent(String(path?.session_id))}/relay`,
    query,
    headers,
    body,
  });
}

export type CreateRealtimeSessionParams = {
  path?: Record<string, never>;
  query?: Record<string, never>;
  headers?: Record<string, never>;
  body?: never;
};

/** Creates a short-lived, metered realtime session and returns relay connection details. */
export async function createRealtimeSession(client: Client, args: CreateRealtimeSessionParams = {}): Promise<unknown> {
  const { query, headers, body } = args;
  return client.request<unknown>({ method: "POST", path: "/audio/realtime/sessions", query, headers, body });
}

type RealtimeSessionMutationParams = {
  path?: { session_id: string };
  query?: Record<string, never>;
  headers?: Record<string, never>;
  body?: never;
};

export type ExtendRealtimeSessionReservationParams = RealtimeSessionMutationParams;
export type FinalizeRealtimeSessionParams = RealtimeSessionMutationParams;
export type MarkRealtimeSessionConnectedParams = RealtimeSessionMutationParams;
export type UpdateRealtimeSessionUsageParams = RealtimeSessionMutationParams;

function mutateRealtimeSession(client: Client, suffix: string, args: RealtimeSessionMutationParams): Promise<unknown> {
  const { path, query, headers, body } = args;
  return client.request<unknown>({
    method: "POST",
    path: `/audio/realtime/sessions/${encodeURIComponent(String(path?.session_id))}/${suffix}`,
    query,
    headers,
    body,
  });
}

/** Extends a realtime session reservation. */
export function extendRealtimeSessionReservation(client: Client, args: ExtendRealtimeSessionReservationParams = {}): Promise<unknown> {
  return mutateRealtimeSession(client, "extend", args);
}

/** Finalizes a realtime session. */
export function finalizeRealtimeSession(client: Client, args: FinalizeRealtimeSessionParams = {}): Promise<unknown> {
  return mutateRealtimeSession(client, "finalize", args);
}

/** Marks a realtime session connected. */
export function markRealtimeSessionConnected(client: Client, args: MarkRealtimeSessionConnectedParams = {}): Promise<unknown> {
  return mutateRealtimeSession(client, "connected", args);
}

/** Updates realtime session usage. */
export function updateRealtimeSessionUsage(client: Client, args: UpdateRealtimeSessionUsageParams = {}): Promise<unknown> {
  return mutateRealtimeSession(client, "usage", args);
}
