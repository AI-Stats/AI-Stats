import { expoClient } from "@better-auth/expo/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { BetterAuthClientPlugin } from "better-auth";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { resolveSecureOrigin } from "@/lib/origins";

const extras = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
const configuredOrigin = process.env.EXPO_PUBLIC_PHASEO_ORIGIN ?? extras?.phaseoOrigin ?? "https://phaseo.app";

export const authClient = createAuthClient({
	baseURL: resolveSecureOrigin(configuredOrigin, "https://phaseo.app"),
	plugins: [
		expoClient({
			scheme: "phaseo",
			storagePrefix: "phaseo-auth",
			storage: SecureStore,
		}) as unknown as BetterAuthClientPlugin,
		magicLinkClient(),
	],
});
