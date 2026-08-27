import { redirect } from "next/navigation";

export const metadata = { title: "Privacy - Settings" };

export default function AccountPrivacyPage() {
	redirect("/settings/privacy");
}
