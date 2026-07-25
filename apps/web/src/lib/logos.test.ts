import { getLogoLabel, resolveLogo } from "@/lib/logos";

describe("logos", () => {
	test("resolves the DigitalOcean logo asset by provider id", () => {
		expect(resolveLogo("digitalocean")).toMatchObject({
			id: "digitalocean",
			label: "DigitalOcean",
			src: "/logos/digitalocean.svg",
			variant: "color",
		});
	});

	test("normalizes DigitalOcean lookup aliases to the shared logo id", () => {
		expect(resolveLogo("digital-ocean")).toMatchObject({
			id: "digitalocean",
			label: "DigitalOcean",
			src: "/logos/digitalocean.svg",
		});
		expect(getLogoLabel("Digital Ocean")).toBe("DigitalOcean");
	});

	test("resolves Nex AGI themed variants", () => {
		expect(
			resolveLogo("nex-agi", { variant: "light", theme: "light" })
		).toMatchObject({
			id: "nex-agi",
			label: "Nex AGI",
			src: "/logos/nex-agi_light.svg",
			variant: "light",
		});

		expect(
			resolveLogo("Nex AGI", { variant: "dark", theme: "dark" })
		).toMatchObject({
			id: "nex-agi",
			label: "Nex AGI",
			src: "/logos/nex-agi_dark.svg",
			variant: "dark",
		});
	});

	test("resolves the Mind Lab logo by catalogue id", () => {
		expect(resolveLogo("mindai")).toMatchObject({
			id: "mindai",
			label: "Mind Lab",
			src: "/logos/mindai.svg",
			variant: "color",
		});
	});

	test("resolves the Sakana AI logo by catalogue id", () => {
		expect(resolveLogo("sakana")).toMatchObject({
			id: "sakana",
			label: "Sakana AI",
			src: "/logos/sakana.svg",
			variant: "color",
		});
	});
});
