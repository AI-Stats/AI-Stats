import { NextRequest, NextResponse } from "next/server";

import { getStripe } from "@/lib/stripe";
import { requireActiveTeamStripeCustomer } from "@/lib/server/activeTeamStripe";

function parseStripeInvoiceId(body: any): string | null {
	const raw = body?.stripeInvoiceId ?? body?.stripe_invoice_id ?? null;
	if (!raw) return null;
	const id = String(raw).trim();
	return id.startsWith("in_") ? id : null;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}));
		const stripeInvoiceId = parseStripeInvoiceId(body);
		if (!stripeInvoiceId) {
			return NextResponse.json({ error: "Invalid stripe invoice id" }, { status: 400 });
		}

		const { customerId } = await requireActiveTeamStripeCustomer();

		const stripe = getStripe();
		const invoice = await stripe.invoices.retrieve(stripeInvoiceId);
		const invoiceCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
		if (!invoiceCustomerId || invoiceCustomerId !== customerId) {
			return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
		}
		const invoiceUrl = invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null;
		if (!invoiceUrl) {
			return NextResponse.json({ error: "Invoice document unavailable" }, { status: 404 });
		}

		return NextResponse.json({ ok: true, type: "invoice", url: invoiceUrl });
	} catch (err: any) {
		return NextResponse.json(
			{ error: err?.message ?? "invoice_document_lookup_failed" },
			{ status: 500 },
		);
	}
}
