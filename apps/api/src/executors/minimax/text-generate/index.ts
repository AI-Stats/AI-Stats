// Purpose: Executor for minimax / text-generate.
// Why: Isolates provider-specific behavior per capability.
// How: Transforms IR and calls the provider API for this capability.

import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import { executeOpenAIWire } from "@executors/_shared/text-generate/openai-compat";
import { buildTextExecutor, cherryPickIRParams } from "@executors/_shared/text-generate/shared";
import type { ProviderExecutor } from "../../types";

export function preprocess(ir: IRChatRequest, args: ExecutorExecuteArgs): IRChatRequest {
	const next = cherryPickIRParams(ir, args.capabilityParams);
	const minimax = (ir.vendor as any)?.minimax;
	if (minimax) {
		next.vendor = {
			...(next.vendor ?? {}),
			minimax,
		};
	}
	return next;
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	const result = await executeOpenAIWire(args, { useClientStreamingMode: true });
	if (result.kind !== "completed") return result;

	const error = readMinimaxBodyError(result.rawResponse);
	if (!error) return result;
	return {
		...result,
		ir: undefined,
		upstream: new Response(JSON.stringify({
			error: {
				code: error.code,
				message: error.message,
				type: "minimax_api_error",
			},
		}), {
			status: minimaxErrorHttpStatus(error.code),
			headers: { "Content-Type": "application/json" },
		}),
	};
}

export function readMinimaxBodyError(payload: any): { code: number; message: string } | null {
	const rawCode = payload?.base_resp?.status_code ?? payload?.baseResp?.statusCode;
	const code = typeof rawCode === "number" ? rawCode : Number(rawCode);
	if (!Number.isFinite(code) || code === 0) return null;
	const rawMessage = payload?.base_resp?.status_msg ?? payload?.baseResp?.statusMsg;
	return {
		code,
		message: typeof rawMessage === "string" && rawMessage.trim()
			? rawMessage
			: `MiniMax API error ${code}`,
	};
}

export function minimaxErrorHttpStatus(code: number): number {
	if (code === 1002 || code === 1041) return 429;
	if (code === 1004) return 401;
	if (code === 1008) return 402;
	if ([1026, 1027, 1039, 1042, 2013].includes(code)) return 400;
	return 502;
}

export function postprocess(ir: any): any {
	return ir;
}

export function transformStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
	return stream;
}

export const executor: ProviderExecutor = buildTextExecutor({
	preprocess,
	execute,
	postprocess,
	transformStream,
});
