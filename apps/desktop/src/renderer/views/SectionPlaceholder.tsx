import { ArrowRight, Construction } from "lucide-react";

export function SectionPlaceholder({ title }: { title: string }) {
	return (
		<div className="page placeholder-page">
			<div className="empty-state">
				<div className="empty-icon"><Construction size={22} /></div>
				<p className="eyebrow">Desktop foundation</p>
				<h1>{title}</h1>
				<p>This surface is connected to the desktop shell and ready for its Phaseo service integration.</p>
				<button className="secondary-button" type="button">View implementation plan <ArrowRight size={14} /></button>
			</div>
		</div>
	);
}
