import {
	Activity,
	ArrowUpRight,
	Boxes,
	CircleDollarSign,
	CloudCog,
	Gauge,
	KeyRound,
	Route,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const platformLinks = [
	{
		icon: Boxes,
		title: "Model catalogue",
		description: "Explore models, providers, modalities, pricing, and capabilities.",
		url: "https://phaseo.app/models",
		meta: "1,000+ models",
	},
	{
		icon: Route,
		title: "Gateway",
		description: "Route requests across providers with fallbacks and policy controls.",
		url: "https://phaseo.app/settings/gateway",
		meta: "OpenAI compatible",
	},
	{
		icon: Activity,
		title: "Observability",
		description: "Inspect latency, spend, routing, reliability, and request traces.",
		url: "https://phaseo.app/observability",
		meta: "Workspace insights",
	},
];

export function PlatformHome() {
	const openExternal = (url: string) => {
		if (window.phaseoDesktop) void window.phaseoDesktop.openExternal(url);
		else window.open(url, "_blank", "noopener,noreferrer");
	};

	return (
		<div className="page platform-home">
			<section className="page-heading platform-heading">
				<div>
					<p className="eyebrow">Phaseo Platform</p>
					<h1>Your AI infrastructure, beside your work.</h1>
					<p>Discover, route, and observe the models powering your agents and applications.</p>
				</div>
				<button className="primary-button" type="button" onClick={() => openExternal("https://phaseo.app/settings/api-keys")}>
					<KeyRound size={16} />
					Manage API keys
				</button>
			</section>

			<section className="platform-summary">
				<div className="platform-summary-copy">
					<span className="platform-kicker"><Sparkles size={13} /> Model-neutral infrastructure</span>
					<h2>Use the right model for every Mission.</h2>
					<p>
						Phaseo connects the models used by your agents with the work they produce, giving every run a clear route, price, trace, and outcome.
					</p>
					<div className="summary-actions">
						<button className="primary-button" type="button" onClick={() => openExternal("https://phaseo.app/models")}>
							Browse models <ArrowUpRight size={14} />
						</button>
						<button className="secondary-button" type="button" onClick={() => openExternal("https://docs.phaseo.app")}>
							Read documentation
						</button>
					</div>
				</div>
				<div className="route-visual" aria-label="Gateway route overview">
					<div className="route-source"><CloudCog size={18} /><span>Phaseo Gateway</span></div>
					<div className="route-lines"><i /><i /><i /></div>
					<div className="route-targets">
						<span>OpenAI</span><span>Anthropic</span><span>Google</span>
					</div>
				</div>
			</section>

			<section className="platform-card-grid">
				{platformLinks.map((link) => {
					const Icon = link.icon;
					return (
						<button className="platform-card" type="button" key={link.title} onClick={() => openExternal(link.url)}>
							<div className="platform-card-icon"><Icon size={19} /></div>
							<div className="platform-card-title"><h2>{link.title}</h2><ArrowUpRight size={15} /></div>
							<p>{link.description}</p>
							<span>{link.meta}</span>
						</button>
					);
				})}
			</section>

			<section className="panel infrastructure-panel">
				<div className="panel-heading">
					<div><h2>Infrastructure status</h2><p>Connect your Phaseo account to display live workspace data.</p></div>
					<span className="status-pill"><ShieldCheck size={13} /> Ready</span>
				</div>
				<div className="infrastructure-grid">
					<InfrastructureItem icon={Gauge} label="Gateway health" value="Available" />
					<InfrastructureItem icon={CircleDollarSign} label="Workspace spend" value="Connect account" />
					<InfrastructureItem icon={Activity} label="Recent requests" value="Connect account" />
				</div>
			</section>
		</div>
	);
}

function InfrastructureItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
	return <div className="infrastructure-item"><Icon size={16} /><span>{label}</span><strong>{value}</strong></div>;
}
