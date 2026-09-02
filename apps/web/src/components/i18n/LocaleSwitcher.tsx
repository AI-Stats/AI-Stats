import type { ComponentProps } from "react";
import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
	getLocaleDefinition,
	publicLocales,
	type PublicLocale,
} from "@/i18n/routing";
import { cn } from "@/lib/utils";

export type LocaleSwitcherProps = {
	currentLocale: PublicLocale;
	returnPath: ComponentProps<typeof Link>["href"];
	label: string;
	className?: string;
	placement?: "top" | "bottom";
};

const localeFlagCodes = {
	"en-GB": "gb",
	"en-US": "us",
	"zh-Hans": "cn",
	hi: "in",
	"es-ES": "es",
	"fr-FR": "fr",
	"de-DE": "de",
	"pt-BR": "br",
	ja: "jp",
	"ar-SA": "sa",
} as const satisfies Record<PublicLocale, string>;

function LocaleFlag({ locale }: { locale: PublicLocale }) {
	return (
		<span className="relative size-5 shrink-0 overflow-hidden rounded-full border border-black/10 bg-muted shadow-xs dark:border-white/15">
			<Image
				src={`/flags/${localeFlagCodes[locale]}.svg`}
				alt=""
				fill
				sizes="20px"
				className="object-cover"
			/>
		</span>
	);
}

/**
 * A progressively enhanced locale switcher. Explicit locale links keep the
 * control usable without client JavaScript and let next-intl generate the
 * canonical locale-prefixed URL for the supplied locale-independent path.
 */
export function LocaleSwitcher({
	currentLocale,
	returnPath,
	label,
	className,
	placement = "bottom",
}: LocaleSwitcherProps) {
	const currentDefinition = getLocaleDefinition(currentLocale);

	return (
		<nav aria-label={label} className={cn("relative inline-block", className)}>
			<details className="group relative">
				<summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
					<LocaleFlag locale={currentLocale} />
					<span className="sr-only">{label}: </span>
					<bdi lang={currentLocale} dir={currentDefinition.dir}>
						{currentDefinition.nativeName}
					</bdi>
					<ChevronDown
						className="size-4 shrink-0 transition-transform group-open:rotate-180"
						aria-hidden="true"
					/>
				</summary>

				<ul
					className={cn(
						"absolute end-0 z-50 max-h-80 min-w-64 overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl",
						placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
					)}
				>
					{publicLocales.map((locale) => {
						const definition = getLocaleDefinition(locale);
						const selected = locale === currentLocale;

						return (
							<li key={locale}>
								<Link
									href={returnPath}
									locale={locale}
									hrefLang={locale}
									prefetch={false}
									aria-current={selected ? "page" : undefined}
									className={cn(
										"flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
										selected && "bg-accent text-accent-foreground",
									)}
								>
									<LocaleFlag locale={locale} />
									<span className="min-w-0 flex-1">
										<bdi
											lang={locale}
											dir={definition.dir}
											className="block truncate font-medium"
										>
											{definition.nativeName}
										</bdi>
										<bdi
											dir="ltr"
											className="block text-xs text-muted-foreground"
										>
											{locale}
										</bdi>
									</span>
									{selected ? (
										<Check className="size-4 shrink-0" aria-hidden="true" />
									) : null}
								</Link>
							</li>
						);
					})}
				</ul>
			</details>
		</nav>
	);
}
