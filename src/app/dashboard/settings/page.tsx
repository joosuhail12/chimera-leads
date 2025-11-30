import { redirect } from "next/navigation";

export default function SettingsPage() {
  // Redirect to email settings as the default settings page
  redirect("/dashboard/settings/email");
}