export type OutputOptions = {
	json: boolean;
};

export type TerminalOptions = {
	isTTY?: boolean;
	env?: NodeJS.ProcessEnv;
};

export type SpinnerOptions = TerminalOptions & {
	enabled?: boolean;
	frames?: string[];
	intervalMs?: number;
	stream?: Pick<NodeJS.WriteStream, "write">;
};

const ANSI = {
	reset: "\u001b[0m",
	bold: "\u001b[1m",
	dim: "\u001b[2m",
	purple: "\u001b[38;5;141m",
	cyan: "\u001b[38;5;81m",
	green: "\u001b[38;5;78m",
	yellow: "\u001b[38;5;221m",
};

export function terminalSupportsColor(options: TerminalOptions = {}): boolean {
	const env = options.env ?? process.env;
	if (env.FORCE_COLOR === "0") return false;
	if (env.FORCE_COLOR && env.FORCE_COLOR !== "0") return true;
	if ("NO_COLOR" in env || env.TERM === "dumb") return false;
	return options.isTTY ?? Boolean(process.stdout.isTTY);
}

export function terminalUi(options: TerminalOptions = {}) {
	const color = terminalSupportsColor(options);
	const paint = (code: string, value: string) => color ? `${code}${value}${ANSI.reset}` : value;
	return {
		color,
		brand: (value: string) => paint(`${ANSI.bold}${ANSI.purple}`, value),
		heading: (value: string) => paint(ANSI.bold, value),
		dim: (value: string) => paint(ANSI.dim, value),
		accent: (value: string) => paint(ANSI.cyan, value),
		success: (value: string) => `${paint(ANSI.green, "✓")} ${value}`,
		progress: (value: string) => `${paint(ANSI.purple, "◆")} ${value}`,
		info: (value: string) => `${paint(ANSI.cyan, "◇")} ${value}`,
		warning: (value: string) => `${paint(ANSI.yellow, "!")} ${value}`,
	};
}

export function createSpinner(label: string, options: SpinnerOptions = {}) {
	const stream = options.stream ?? process.stderr;
	const enabled = options.enabled ?? Boolean(process.stderr.isTTY);
	const frames = options.frames?.length ? options.frames : ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	const ui = terminalUi({ ...options, isTTY: enabled });
	let index = 0;
	let timer: NodeJS.Timeout | undefined;
	let stopped = false;
	const clear = () => { if (enabled) stream.write("\r\u001b[2K"); };
	const render = () => {
		if (!enabled || stopped) return;
		stream.write(`\r${ui.accent(frames[index % frames.length] ?? "-")} ${label}`);
		index += 1;
	};
	if (enabled) {
		render();
		timer = setInterval(render, options.intervalMs ?? 80);
		timer.unref?.();
	}
	const stop = () => {
		if (stopped) return;
		stopped = true;
		if (timer) clearInterval(timer);
		clear();
	};
	return {
		active: enabled,
		stop,
		succeed(message = label) { stop(); if (enabled) stream.write(`${ui.success(message)}\n`); },
		fail(message = label) { stop(); if (enabled) stream.write(`${ui.warning(message)}\n`); },
	};
}

export function printJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function sanitizeTerminalText(value: string): string {
	return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " ");
}

export function printError(error: unknown, options: OutputOptions): void {
	const message = error instanceof Error ? error.message : String(error);
	if (options.json) {
		printJson({ ok: false, error: message });
		return;
	}
	process.stderr.write(`Error: ${sanitizeTerminalText(message)}\n`);
}
