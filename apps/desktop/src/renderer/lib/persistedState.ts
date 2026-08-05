import { useEffect, useState } from "react";

export function usePersistedState<T>(key: string, initialValue: T) {
	const [value, setValue] = useState<T>(() => {
		try {
			const persisted = window.localStorage.getItem(key);
			return persisted ? (JSON.parse(persisted) as T) : initialValue;
		} catch {
			return initialValue;
		}
	});

	useEffect(() => {
		window.localStorage.setItem(key, JSON.stringify(value));
	}, [key, value]);

	return [value, setValue] as const;
}
