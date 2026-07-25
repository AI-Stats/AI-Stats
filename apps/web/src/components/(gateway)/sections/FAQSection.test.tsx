import { renderToStaticMarkup } from "react-dom/server";

import { FAQSection } from "./FAQSection";

describe("FAQSection", () => {
	it("removes collapsed answers from accessibility and keyboard navigation", () => {
		const html = renderToStaticMarkup(<FAQSection />);

		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain('inert=""');
	});
});
