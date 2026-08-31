import type { Metadata } from "next";
import { UsageLogsRoutePage } from "../page";

export const metadata: Metadata = { title: "Session Logs - Settings" };

export default function SessionsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <UsageLogsRoutePage view="sessions" searchParams={props.searchParams} />;
}
