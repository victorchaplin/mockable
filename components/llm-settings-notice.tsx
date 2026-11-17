import Link from "next/link";

/**
 * Shown when an LLM-backed action is attempted without a saved key. The
 * request helper blocks the network call; this notice points at Settings.
 */
export function LlmSettingsNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="alert"
      data-testid="llm-settings-notice"
      className={`rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      <p className="font-medium">Add your LLM key to continue.</p>
      <p className="mt-1">
        mockable uses your own provider key, stored in this browser only.{" "}
        <Link href="/settings" className="font-medium underline underline-offset-2">
          Open Settings
        </Link>{" "}
        to configure a provider, model, and API key.
      </p>
    </div>
  );
}
