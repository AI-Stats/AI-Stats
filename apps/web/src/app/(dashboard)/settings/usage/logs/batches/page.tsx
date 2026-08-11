import type { Metadata } from "next";
import { UsageLogsRoutePage } from "../page";

export const metadata: Metadata = { title: "Batch Logs - Settings" };

export default function BatchesPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <UsageLogsRoutePage view="jobs" jobKind="batch" searchParams={props.searchParams} />;
}
