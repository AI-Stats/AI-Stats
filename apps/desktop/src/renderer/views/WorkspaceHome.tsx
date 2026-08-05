import {
	ArrowRight,
	Bot,
	CircleDot,
	Code2,
	GitPullRequest,
	GitBranch,
	Inbox,
	MessageSquare,
	Plus,
	Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const attentionItems = [
	{
		icon: GitBranch,
		title: "Connect a GitHub organisation",
		description: "Bring repositories, pull requests, checks, and reviews into your workspace.",
		action: "Connect GitHub",
	},
	{
		icon: Bot,
		title: "Add your first coding agent",
		description: "Connect a local harness or configure a model through the Phaseo gateway.",
		action: "Set up agent",
	},
];

export function WorkspaceHome() {
	return (
		<div className="page workspace-home">
			<section className="page-heading">
				<div>
					<p className="eyebrow">Monday, 3 August</p>
					<h1>Good afternoon, Daniel.</h1>
					<p>Plan work, coordinate agents, and move changes towards production.</p>
				</div>
				<button className="primary-button" type="button">
					<Plus size={16} />
					Create mission
				</button>
			</section>

			<section className="metric-grid" aria-label="Workspace summary">
				<MetricCard icon={Inbox} label="Needs your attention" value="2" tone="blue" />
				<MetricCard icon={Bot} label="Active agents" value="0" />
				<MetricCard icon={CircleDot} label="Open missions" value="0" />
				<MetricCard icon={GitPullRequest} label="Ready to review" value="0" />
			</section>

			<div className="workspace-grid">
				<section className="panel attention-panel">
					<div className="panel-heading">
						<div>
							<h2>Get the workspace ready</h2>
							<p>Connect the systems Phaseo needs to coordinate your development work.</p>
						</div>
						<span className="count-pill">2 steps</span>
					</div>

					<div className="attention-list">
						{attentionItems.map((item) => {
							const Icon = item.icon;
							return (
								<article className="attention-item" key={item.title}>
									<div className="attention-icon">
										<Icon size={18} />
									</div>
									<div>
										<h3>{item.title}</h3>
										<p>{item.description}</p>
									</div>
									<button className="secondary-button" type="button">
										{item.action}
										<ArrowRight size={14} />
									</button>
								</article>
							);
						})}
					</div>
				</section>

				<section className="panel activity-panel">
					<div className="panel-heading">
						<div>
							<h2>Live activity</h2>
							<p>Human and agent work across this workspace.</p>
						</div>
						<span className="live-indicator"><i /> Live</span>
					</div>
					<div className="empty-state compact-empty">
						<Sparkles size={22} />
						<h3>Your activity stream will appear here</h3>
						<p>Start a Mission or connect GitHub to see plans, runs, reviews, and releases.</p>
					</div>
				</section>

				<section className="panel recent-panel">
					<div className="panel-heading">
						<div>
							<h2>Recent work</h2>
							<p>Return to missions, conversations, and repositories.</p>
						</div>
					</div>
					<div className="quick-start-grid">
						<QuickStart icon={CircleDot} label="Mission" hint="Define an outcome" />
						<QuickStart icon={MessageSquare} label="Room" hint="Start a conversation" />
						<QuickStart icon={Code2} label="Repository" hint="Connect source code" />
					</div>
				</section>
			</div>
		</div>
	);
}

function MetricCard({
	icon: Icon,
	label,
	value,
	tone,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	tone?: "blue";
}) {
	return (
		<article className={tone ? `metric-card metric-${tone}` : "metric-card"}>
			<div className="metric-icon"><Icon size={16} /></div>
			<span>{label}</span>
			<strong>{value}</strong>
		</article>
	);
}

function QuickStart({ icon: Icon, label, hint }: { icon: LucideIcon; label: string; hint: string }) {
	return (
		<button className="quick-start" type="button">
			<span><Icon size={17} /></span>
			<div><strong>{label}</strong><small>{hint}</small></div>
			<Plus size={14} />
		</button>
	);
}
