import Link from "next/link";
import { ArrowRight, FileAudio, FileImage, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function supportsProvenanceVerification(outputTypes: unknown): boolean {
	const values = Array.isArray(outputTypes)
		? outputTypes.map(String)
		: typeof outputTypes === "string" ? outputTypes.split(",") : [];
	return values.some((value) => /(^|[^a-z])(image|audio|speech|music|tts)([^a-z]|$)/i.test(value));
}

export default function ModelVerificationSection({ outputTypes }: { outputTypes: unknown }) {
	const normalized = Array.isArray(outputTypes) ? outputTypes.join(",") : String(outputTypes ?? "");
	const supportsImage = /(^|[^a-z])image([^a-z]|$)/i.test(normalized);
	const supportsAudio = /(^|[^a-z])(audio|speech|music|tts)([^a-z]|$)/i.test(normalized);

	return (
		<>
			<div>
				<h2 className="text-xl font-semibold tracking-tight">Verification</h2>
				<p className="mt-1 text-sm text-muted-foreground">Check generated media for known OpenAI provenance signals.</p>
			</div>
			<Card className="overflow-hidden border-border/80 bg-muted/10">
				<CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
					<div className="flex min-w-0 gap-4">
						<div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-primary shadow-xs"><ShieldCheck className="size-5" /></div>
						<div>
							<p className="font-medium">Verify a generated file</p>
							<p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Upload {supportsImage && supportsAudio ? "an image or audio file" : supportsImage ? "an image" : "an audio file"} to look for supported C2PA and SynthID signals. A negative result does not prove that a file is human-made.</p>
							<div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
								{supportsImage ? <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1"><FileImage className="size-3.5" />Images</span> : null}
								{supportsAudio ? <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1"><FileAudio className="size-3.5" />Audio</span> : null}
							</div>
						</div>
					</div>
					<Button asChild variant="outline" className="shrink-0"><Link href="/tools/content-provenance">Open checker<ArrowRight /></Link></Button>
				</CardContent>
			</Card>
		</>
	);
}
