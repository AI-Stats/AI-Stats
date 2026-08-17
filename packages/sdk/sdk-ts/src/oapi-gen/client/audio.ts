import type { Client } from "../../runtime/client.js";

export type ConnectRealtimeSessionRelayParams = {
  path?: {
    session_id: string;
  };
  query?: Record<string, never>;
  headers?: Record<string, never>;
  body?: never;
};

/**
 * Upgrades the request to the authenticated realtime WebSocket relay.
 */
export async function connectRealtimeSessionRelay(
  client: Client,
  args: ConnectRealtimeSessionRelayParams = {},
): Promise<unknown> {
  const { path, query, headers, body } = args;
  const resolvedPath = `/audio/realtime/sessions/${encodeURIComponent(String(path?.["session_id"]))}/relay`;
  return client.request<unknown>({
    method: "GET",
    path: resolvedPath,
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

/**
 * Creates a short-lived, metered realtime session and returns the relay connection details.
 */
export async function createRealtimeSession(
  client: Client,
  args: CreateRealtimeSessionParams = {},
): Promise<unknown> {
  const { path, query, headers, body } = args;
  const resolvedPath = "/audio/realtime/sessions";
  return client.request<unknown>({
    method: "POST",
    path: resolvedPath,
    query,
    headers,
    body,
  });
}

export type ExtendRealtimeSessionReservationParams = {
  path?: {
    session_id: string;
  };
  query?: Record<string, never>;
  headers?: Record<string, never>;
  body?: never;
};

/**
 * Extend a realtime session reservation
 */
export async function extendRealtimeSessionReservation(
  client: Client,
  args: ExtendRealtimeSessionReservationParams = {},
): Promise<unknown> {
  const { path, query, headers, body } = args;
  const resolvedPath = `/audio/realtime/sessions/${encodeURIComponent(String(path?.["session_id"]))}/extend`;
  return client.request<unknown>({
    method: "POST",
    path: resolvedPath,
    query,
    headers,
    body,
  });
}

export type FinalizeRealtimeSessionParams = {
  path?: {
    session_id: string;
  };
  query?: Record<string, never>;
  headers?: Record<string, never>;
  body?: never;
};

/**
 * Finalize a realtime session
 */
export async function finalizeRealtimeSession(
  client: Client,
  args: FinalizeRealtimeSessionParams = {},
): Promise<unknown> {
  const { path, query, headers, body } = args;
  const resolvedPath = `/audio/realtime/sessions/${encodeURIComponent(String(path?.["session_id"]))}/finalize`;
  return client.request<unknown>({
    method: "POST",
    path: resolvedPath,
    query,
    headers,
    body,
  });
}

export type MarkRealtimeSessionConnectedParams = {
  path?: {
    session_id: string;
  };
  query?: Record<string, never>;
  headers?: Record<string, never>;
  body?: never;
};

/**
 * Mark a realtime session connected
 */
export async function markRealtimeSessionConnected(
  client: Client,
  args: MarkRealtimeSessionConnectedParams = {},
): Promise<unknown> {
  const { path, query, headers, body } = args;
  const resolvedPath = `/audio/realtime/sessions/${encodeURIComponent(String(path?.["session_id"]))}/connected`;
  return client.request<unknown>({
    method: "POST",
    path: resolvedPath,
    query,
    headers,
    body,
  });
}

export type UpdateRealtimeSessionUsageParams = {
  path?: {
    session_id: string;
  };
  query?: Record<string, never>;
  headers?: Record<string, never>;
  body?: never;
};

/**
 * Update realtime session usage
 */
export async function updateRealtimeSessionUsage(
  client: Client,
  args: UpdateRealtimeSessionUsageParams = {},
): Promise<unknown> {
  const { path, query, headers, body } = args;
  const resolvedPath = `/audio/realtime/sessions/${encodeURIComponent(String(path?.["session_id"]))}/usage`;
  return client.request<unknown>({
    method: "POST",
    path: resolvedPath,
    query,
    headers,
    body,
  });
}
