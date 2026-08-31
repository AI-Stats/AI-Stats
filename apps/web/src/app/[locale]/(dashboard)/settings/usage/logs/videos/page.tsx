import type { Metadata } from "next";
import { UsageLogsRoutePage } from "../page";

export const metadata: Metadata = { title: "Video Logs - Settings" };

export default function VideosPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	return <UsageLogsRoutePage view="jobs" jobKind="video" searchParams={props.searchParams} />;
}
