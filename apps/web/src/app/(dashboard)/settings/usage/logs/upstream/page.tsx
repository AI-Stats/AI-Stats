import type { Metadata } from "next";
import { UsageLogsRoutePage } from "../page";

export const metadata: Metadata = { title: "Upstream Requests - Settings" };

export default function UpstreamPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <UsageLogsRoutePage view="upstream" searchParams={props.searchParams} />;
}
