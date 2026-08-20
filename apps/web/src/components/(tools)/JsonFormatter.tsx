"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle } from "lucide-react";
import { ToolPageHeader } from "@/components/(tools)/ToolPageHeader";

export default function JsonFormatter() {
	const [input, setInput] = useState('{"name": "John", "age": 30, "city": "New York"}');
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");

	const formatJson = () => {
		try {
			const parsed = JSON.parse(input);
			const formatted = JSON.stringify(parsed, null, 2);
			setOutput(formatted);
			setError("");
		} catch (err) {
			setError("Invalid JSON: " + (err as Error).message);
			setOutput("");
		}
	};

	const minifyJson = () => {
		try {
			const parsed = JSON.parse(input);
			const minified = JSON.stringify(parsed);
			setOutput(minified);
			setError("");
		} catch (err) {
			setError("Invalid JSON: " + (err as Error).message);
			setOutput("");
		}
	};

	const validateJson = () => {
		try {
			JSON.parse(input);
			setError("");
			setOutput("✓ Valid JSON");
		} catch (err) {
			setError("Invalid JSON: " + (err as Error).message);
			setOutput("");
		}
	};

	const clearAll = () => {
		setInput("");
		setOutput("");
		setError("");
	};

	return (
		<div className="container mx-auto px-4 py-8 sm:py-12">
			<ToolPageHeader title="JSON Formatter" description="Format, validate, and beautify JSON data." />

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				<Card>
					<CardHeader>
						<CardTitle>JSON Input</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<Textarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							className="min-h-[300px] font-mono"
							placeholder="Paste your JSON here..."
						/>
						<div className="flex flex-wrap gap-2">
							<Button onClick={formatJson} variant="default">
								Format
							</Button>
							<Button onClick={minifyJson} variant="outline">
								Minify
							</Button>
							<Button onClick={validateJson} variant="outline">
								Validate
							</Button>
							<Button onClick={clearAll} variant="outline">
								Clear
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Output</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{error && (
							<Alert variant="destructive">
								<XCircle className="h-4 w-4" />
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
						{!error && output === "✓ Valid JSON" && (
							<Alert>
								<CheckCircle className="h-4 w-4" />
								<AlertDescription>Valid JSON</AlertDescription>
							</Alert>
						)}
						<Textarea
							value={output}
							readOnly
							className="min-h-[300px] font-mono"
							placeholder="Formatted JSON will appear here..."
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
