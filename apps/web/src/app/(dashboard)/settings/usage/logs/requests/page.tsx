import type { Metadata } from "next";
import { UsageLogsRoutePage } from "../page";

export const metadata: Metadata = { title: "Request Logs - Settings" };

export default function RequestsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <UsageLogsRoutePage view="logs" searchParams={props.searchParams} />;
}
