import Link from "next/link";
import { NewMockFlow } from "@/components/new-mock-flow";

export default function NewMockPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to projects
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">New mock</h1>
        <p className="max-w-2xl text-slate-600">
          Describe your product. mockable generates five entry screens, each
          with a different layout archetype, as live HTML/CSS previews you can
          compare before picking.
        </p>
      </div>
      <NewMockFlow />
    </main>
  );
}
