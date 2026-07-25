"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FAQItemProps {
	question: string;
	answer: ReactNode;
	isOpen: boolean;
	index: number;
	onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, index, onToggle }: FAQItemProps) {
	const answerId = `faq-answer-${index}`;

	return (
		<article
			className={cn(
				"group overflow-hidden rounded-xl border transition-all duration-300",
				isOpen
					? "border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
					: "border-zinc-200/60 bg-white/80 hover:border-zinc-300/80 hover:bg-white dark:border-zinc-800/70 dark:bg-zinc-950/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/70",
			)}
		>
			<h2>
				<button
					onClick={onToggle}
					type="button"
					aria-expanded={isOpen}
					aria-controls={answerId}
					className="flex w-full items-start justify-between gap-4 p-5 text-left"
				>
					<span
					className={cn(
						"text-base font-medium transition-colors",
						isOpen
							? "text-zinc-900 dark:text-zinc-100"
							: "text-zinc-700 dark:text-zinc-200",
					)}
				>
					{question}
					</span>
					<ChevronDown
						className={cn(
							"mt-0.5 h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-300",
							isOpen && "rotate-180 text-zinc-600 dark:text-zinc-300",
						)}
					/>
				</button>
			</h2>
			<div
				className={cn(
					"grid transition-all duration-300",
					isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
				)}
			>
				<div id={answerId} className="overflow-hidden">
					<div className="border-t border-zinc-100 px-5 pb-5 pt-4 dark:border-zinc-800">
						<p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
							{answer}
						</p>
					</div>
				</div>
			</div>
		</article>
	);
}

export const FAQ_ITEMS = [
	{
		question: "How can I compare AI models on Phaseo?",
		answer: (
			<>
				Start in the <Link href="/models" className="font-medium underline underline-offset-4">model directory</Link>, then open a model page to compare its pricing, providers, benchmark results, latency signals, and compatibility details. The information shown varies with the data available for that model.
			</>
		),
	},
	{
		question: "What does a model page tell me?",
		answer: (
			<>
				A model page brings together the useful facts for a specific model: who created it, which providers offer it, the listed prices, benchmark coverage, and gateway availability. Use the page tabs to go deeper into pricing, providers, performance, and quickstart details.
			</>
		),
	},
	{
		question: "How does Phaseo calculate model pricing?",
		answer: (
			<>
				Phaseo stores each provider route&apos;s meter, unit size, currency, plan, and effective dates. Input and output rates remain separate, and token prices are normalised per 1M tokens for comparison; they are not combined into a blended headline price. Read the <Link href="/how-phaseo-calculates-model-pricing" className="font-medium underline underline-offset-4">pricing methodology</Link> or enter your own token volumes in the <Link href="/tools/pricing-calculator" className="font-medium underline underline-offset-4">pricing calculator</Link>.
			</>
		),
	},
	{
		question: "What does gateway availability mean?",
		answer: (
			<>
				Gateway availability describes whether Phaseo currently has an eligible route for a model. It is separate from a model&apos;s quality or benchmark performance. Provider status can change, so check the model&apos;s providers and availability information before relying on a route in production.
			</>
		),
	},
	{
		question: "Can I use Phaseo as an AI gateway?",
		answer: (
			<>
				Yes. Phaseo Gateway provides one OpenAI-compatible interface for supported models and providers. Create an API key, choose a model, and use the same integration surface while retaining model and provider choice.
			</>
		),
	},
	{
		question: "Can I use my own provider API keys?",
		answer: (
			<>
				Yes. Bring your own provider keys when you want to retain the provider relationship and billing directly, while still using Phaseo&apos;s routing, health, and policy layer.
			</>
		),
	},
	{
		question: "Which providers and model types can I explore?",
		answer: (
			<>
				Browse the <Link href="/api-providers" className="font-medium underline underline-offset-4">provider directory</Link> for provider coverage, or filter the model directory by capabilities such as chat, embeddings, image, audio, video, and moderation. A provider page is the best place to check its currently listed model catalogue.
			</>
		),
	},
	{
		question: "How are benchmarks and performance data handled?",
		answer: (
			<>
				Benchmark scores are shown alongside the benchmark and its methodology so that comparisons retain their context. Read <Link href="/how-phaseo-normalises-ai-benchmarks" className="font-medium underline underline-offset-4">how Phaseo normalises AI benchmarks</Link> and <Link href="/how-phaseo-measures-latency-throughput" className="font-medium underline underline-offset-4">how it measures latency and throughput</Link> before making a production decision from a single score.
			</>
		),
	},
	{
		question: "What should I do if a listing looks wrong or incomplete?",
		answer: (
			<>
				Use the <Link href="/contribute" className="font-medium underline underline-offset-4">contribution page</Link> to report a correction or add missing information. Accurate, source-backed reports help keep the directory useful as providers change their catalogues and pricing.
			</>
		),
	},
];

export function FAQSection() {
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	const handleToggle = (index: number) => {
		setOpenIndex(openIndex === index ? null : index);
	};

	const midPoint = Math.ceil(FAQ_ITEMS.length / 2);
	const leftColumn = FAQ_ITEMS.slice(0, midPoint);
	const rightColumn = FAQ_ITEMS.slice(midPoint);

	return (
		<section className="relative overflow-hidden py-20 sm:py-28">
			<div className="relative mx-auto max-w-7xl px-6 lg:px-8">
				<div className="mx-auto max-w-3xl text-center">
					<h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
						AI model database and gateway FAQ
					</h1>
					<p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
						Practical answers for comparing models, understanding the data, and using the gateway.
						Cannot find an answer?{" "}
						<a
							href="mailto:support@phaseo.ai"
							className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
						>
							Reach out to our team
						</a>
						.
					</p>
				</div>

				<div className="mt-16 grid gap-4 lg:grid-cols-2">
					<div className="space-y-4">
						{leftColumn.map((item, index) => (
							<FAQItem
								key={item.question}
								question={item.question}
								answer={item.answer}
								isOpen={openIndex === index}
								index={index}
								onToggle={() => handleToggle(index)}
							/>
						))}
					</div>
					<div className="space-y-4">
						{rightColumn.map((item, index) => {
							const actualIndex = index + midPoint;
							return (
								<FAQItem
								key={item.question}
								question={item.question}
								answer={item.answer}
								isOpen={openIndex === actualIndex}
								index={actualIndex}
									onToggle={() => handleToggle(actualIndex)}
								/>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}

