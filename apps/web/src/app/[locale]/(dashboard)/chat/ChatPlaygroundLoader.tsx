import ChatPlayground from "@/components/(chat)/ChatPlayground";
import { fetchFrontendGatewayModels } from "@/lib/fetchers/frontend/fetchFrontendGatewayModels";
import { fetchChatEffectivePolicy } from "@/lib/fetchers/internal/fetchChatEffectivePolicy";
import { applyChatEffectivePolicy } from "@/lib/chat/effectivePolicy";

type ChatPlaygroundLoaderProps = {
    modelParam?: string | null;
    promptParam?: string | null;
};

const decodeQueryValue = (value: string): string => {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

export default async function ChatPlaygroundLoader({
    modelParam,
    promptParam,
}: ChatPlaygroundLoaderProps) {
	const [catalogue, effectivePolicy] = await Promise.all([fetchFrontendGatewayModels(), fetchChatEffectivePolicy().catch(() => null)]);
	const models = applyChatEffectivePolicy(catalogue, effectivePolicy);
	const trimmedModelParam = decodeQueryValue((modelParam ?? "").trim());
	const modelIdSet = new Set(models.map((m) => m.modelId));
	let resolvedModelParam: string | null = trimmedModelParam || null;

	if (resolvedModelParam && !modelIdSet.has(resolvedModelParam)) {
		// Unknown/unsupported model; let the playground fall back to its default.
		resolvedModelParam = null;
	}

    return (
        <ChatPlayground
            models={models}
            modelParam={resolvedModelParam}
            promptParam={promptParam ?? null}
        />
    );
}
