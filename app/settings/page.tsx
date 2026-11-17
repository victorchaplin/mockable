import Link from "next/link";
import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to projects
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="max-w-xl text-slate-600">
          mockable uses your own LLM key (bring your own key). Choose a provider
          and model, then paste your API key. Everything is stored in this
          browser.
        </p>
      </div>
      <SettingsForm />
    </main>
  );
}
