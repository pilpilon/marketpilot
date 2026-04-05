import { redirect } from "next/navigation";

// Social accounts are now user-level (one connection shared across all projects).
// Redirect to the global settings page.
export default async function LegacyProjectSocialPage() {
  redirect("/dashboard/settings/social");
}
