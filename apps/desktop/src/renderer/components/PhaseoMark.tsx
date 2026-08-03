export function PhaseoMark({ compact = false }: { compact?: boolean }) {
	return (
		<div className="brand" aria-label="Phaseo">
			<div className="brand-mark" aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
			{compact ? null : <span className="brand-name">Phaseo</span>}
		</div>
	);
}
