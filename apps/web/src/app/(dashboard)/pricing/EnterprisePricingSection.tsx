import Link from "next/link";
import { ArrowRight, Check, Landmark, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ENTERPRISE_TIERS } from "@/lib/billing/enterprisePricing";

const sharedFeatures = ["SAML SSO and SCIM", "Departments and workspace roles", "Audit and governance controls", "Priority support foundations"];

export function EnterprisePricingSection() {
	return (
		<section className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-zinc-950 px-5 py-8 text-zinc-50 shadow-[0_28px_90px_-58px_rgba(16,185,129,0.9)] dark:border-zinc-800 sm:px-8 sm:py-10">
			<div className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl" />
			<div className="relative grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Enterprise, self-serve</p>
					<h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Identity and payment terms that switch on immediately.</h2>
					<p className="mt-4 max-w-lg text-sm leading-6 text-zinc-300">Choose Core for enterprise controls with standard credit pricing. Choose Included Payments to remove Phaseo’s surcharge within a monthly allowance and on supported USD bank transfers.</p>
					<ul className="mt-6 grid gap-2 text-sm text-zinc-200 sm:grid-cols-2 lg:grid-cols-1">
						{sharedFeatures.map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{feature}</li>)}
					</ul>
					<Button asChild className="mt-7 bg-emerald-300 text-zinc-950 hover:bg-emerald-200"><Link href="/settings/workspaces/settings?enterprise=configure">Build my plan <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
					<p className="mt-3 text-xs text-zinc-500">USD monthly billing. No sales call required.</p>
				</div>

				<div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] backdrop-blur">
					<div className="grid grid-cols-[1.1fr_0.9fr_0.9fr] border-b border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
						<span>Active members</span><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Core</span><span className="flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" />Included</span>
					</div>
					{ENTERPRISE_TIERS.map((tier) => (
						<div key={tier.key} className="grid grid-cols-[1.1fr_0.9fr_0.9fr] items-center border-b border-white/10 px-4 py-4 last:border-0">
							<p className="text-sm font-medium">{tier.label}</p>
							<div><p><span className="text-lg font-semibold">${tier.coreMonthlyUsd}</span><span className="text-xs text-zinc-500">/mo</span></p><p className="mt-1 text-[11px] text-zinc-500">Standard top-up fee</p></div>
							<div><p><span className="text-lg font-semibold text-emerald-300">${tier.includedPaymentsMonthlyUsd}</span><span className="text-xs text-zinc-500">/mo</span></p><p className="mt-1 text-[11px] text-zinc-500">${tier.includedCardTopUpUsd.toLocaleString("en-US")} allowance</p></div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
