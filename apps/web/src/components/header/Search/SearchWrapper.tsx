import Search from "./Search";

interface SearchWrapperProps {
	className?: string;
	mobileGhost?: boolean;
}

export function SearchWrapper({ className, mobileGhost }: SearchWrapperProps) {
	return <Search className={className} mobileGhost={mobileGhost} />;
}
