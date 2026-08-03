/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
	packagerConfig: {
		asar: true,
		appBundleId: "app.phaseo.desktop",
		appCategoryType: "public.app-category.developer-tools",
		name: "Phaseo",
		ignore: [
			/^\/node_modules(?:\/|$)/,
			/^\/(?:release|scripts|src)(?:\/|$)/,
			/^\/(?:eslint\.config\.js|tsconfig\.json|vite\..*\.config\.ts)$/,
		],
	},
	makers: [
		{
			name: "@electron-forge/maker-msix",
			platforms: ["win32"],
			config: {
				manifestVariables: {
					publisher: "CN=Phaseo",
					publisherDisplayName: "Phaseo",
					identityName: "Phaseo.Desktop",
				},
			},
		},
		{ name: "@electron-forge/maker-zip", platforms: ["win32", "darwin"] },
		{ name: "@electron-forge/maker-dmg", platforms: ["darwin"] },
		{
			name: "@electron-forge/maker-deb",
			platforms: ["linux"],
			config: { options: { maintainer: "Phaseo", homepage: "https://phaseo.app", categories: ["Development"] } },
		},
	],
};
