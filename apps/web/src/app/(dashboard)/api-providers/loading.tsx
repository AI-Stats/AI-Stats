export default function ApiProvidersLoading() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="space-y-4">
				<h1 className="text-xl font-bold">API Providers</h1>
				<div className="h-11 w-full animate-pulse rounded bg-muted" />
				<div className="overflow-hidden rounded-xl border border-border/70">
					{Array.from({ length: 8 }).map((_, index) => (
						<div
							key={index}
							className="h-20 w-full animate-pulse border-b bg-muted last:border-b-0"
						/>
					))}
				</div>
			</div>
		</div>
	);
}
