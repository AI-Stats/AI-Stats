"use client";

import { useEffect } from "react";
import { ErrorReporter } from "@/components/ErrorReporter";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// eslint-disable-next-line no-console
		console.error(error);
	}, [error]);

	return (
		<html lang="en-GB" dir="ltr">
			<body
				style={{
					alignItems: "center",
					background: "#fff",
					color: "#171717",
					display: "flex",
					fontFamily: "system-ui, sans-serif",
					justifyContent: "center",
					margin: 0,
					minHeight: "100vh",
					padding: "1.5rem",
				}}
		>
				<ErrorReporter error={error} source="global" />
				<main style={{ maxWidth: "28rem", textAlign: "center" }}>
					<h1 style={{ fontSize: "1.5rem", margin: 0 }}>
						Phaseo could not load this page
					</h1>
					<p style={{ lineHeight: 1.5, margin: "0.75rem 0 1.25rem" }}>
						Please try again. If the problem continues, contact Phaseo support.
					</p>
					<button
						type="button"
						onClick={reset}
						style={{
							background: "#171717",
							border: 0,
							borderRadius: "0.5rem",
							color: "#fff",
							cursor: "pointer",
							font: "inherit",
							padding: "0.65rem 1rem",
						}}
					>
						Try again
					</button>
				</main>
			</body>
		</html>
	);
}
