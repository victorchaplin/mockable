"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LAYOUT_ARCHETYPES, archetypeLabel } from "@/lib/llm/archetypes";
import { MissingLlmSettingsError, llmFetch } from "@/lib/llm-client";
import { consumeSse } from "@/lib/sse";
import { LlmSettingsNotice } from "@/components/llm-settings-notice";
import { PreviewFrame } from "@/components/preview-frame";

type VariantCard = {
  variantIndex: number;
  archetype: string;
  status: "pending" | "done" | "failed";
  html?: string;
  proposalId?: string;
  error?: string;
};

type GenerationEvent =
  | { type: "generation"; generationId: string }
  | {
      type: "variant";
      variantIndex: number;
      archetype: string;
      proposalId: string;
      html: string;
    }
  | {
      type: "variant_error";
      variantIndex: number;
      archetype: string;
      error: string;
    }
  | { type: "done" };

function initialVariants(): VariantCard[] {
  return LAYOUT_ARCHETYPES.map((archetype, index) => ({
    variantIndex: index + 1,
    archetype: archetype.id,
    status: "pending",
  }));
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) return;
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  throw new Error(data.error || `Request failed (${response.status}).`);
}

export function NewMockFlow() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [variants, setVariants] = useState<VariantCard[]>(initialVariants);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<"idle" | "generating" | "pick">("idle");
  const [error, setError] = useState<string | null>(null);
  const [settingsNeeded, setSettingsNeeded] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);

  function applyEvent(event: GenerationEvent): void {
    if (event.type === "generation") {
      setGenerationId(event.generationId);
      return;
    }
    if (event.type === "variant") {
      setVariants((current) =>
        current.map((variant) =>
          variant.variantIndex === event.variantIndex
            ? {
                ...variant,
                status: "done",
                html: event.html,
                proposalId: event.proposalId,
                error: undefined,
              }
            : variant,
        ),
      );
      return;
    }
    if (event.type === "variant_error") {
      setVariants((current) =>
        current.map((variant) =>
          variant.variantIndex === event.variantIndex
            ? { ...variant, status: "failed", error: event.error }
            : variant,
        ),
      );
    }
  }

  async function streamVariants(response: Response): Promise<void> {
    await consumeSse(response, (data) => applyEvent(data as GenerationEvent));
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || phase === "generating") return;

    setError(null);
    setSettingsNeeded(false);
    setVariants(initialVariants());
    setGenerationId(null);
    setStarted(true);
    setPhase("generating");

    try {
      const response = await llmFetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      await ensureOk(response);
      await streamVariants(response);
      setPhase("pick");
    } catch (caught) {
      if (caught instanceof MissingLlmSettingsError) {
        setSettingsNeeded(true);
      } else {
        setError(caught instanceof Error ? caught.message : "Generation failed.");
      }
      setPhase("idle");
    }
  }

  async function retryVariant(variantIndex: number) {
    if (!generationId) return;
    setError(null);
    setVariants((current) =>
      current.map((variant) =>
        variant.variantIndex === variantIndex
          ? { ...variant, status: "pending", error: undefined }
          : variant,
      ),
    );

    try {
      const response = await llmFetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId, variantIndex }),
      });
      await ensureOk(response);
      await streamVariants(response);
    } catch (caught) {
      setVariants((current) =>
        current.map((variant) =>
          variant.variantIndex === variantIndex
            ? {
                ...variant,
                status: "failed",
                error:
                  caught instanceof Error ? caught.message : "Retry failed.",
              }
            : variant,
        ),
      );
    }
  }

  async function pickVariant(variant: VariantCard) {
    if (!variant.proposalId || picking !== null) return;
    setPicking(variant.variantIndex);
    setError(null);
    try {
      const response = await fetch("/api/projects/from-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: variant.proposalId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        projectId?: string;
        error?: string;
      };
      if (!response.ok || !data.projectId) {
        throw new Error(data.error || "Could not start the project.");
      }
      router.push(`/project/${data.projectId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start project.");
      setPicking(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={handleGenerate}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label htmlFor="mock-prompt" className="text-sm font-medium">
          Describe the app you want to mock
        </label>
        <textarea
          id="mock-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          placeholder="A booking app for boutique hotels: browse rooms, view availability, and reserve a stay."
          className="resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={phase === "generating" || !prompt.trim()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "generating" ? "Generating 5 proposals…" : "Generate 5 proposals"}
          </button>
          <span className="text-xs text-slate-500">
            Five layout-divergent variants. Pick the one that feels right, then refine it.
          </span>
        </div>
      </form>

      {settingsNeeded ? <LlmSettingsNotice /> : null}
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          {error}{" "}
          <Link href="/settings" className="font-medium underline">
            Open Settings
          </Link>
        </div>
      ) : null}

      {started ? (
        <section aria-label="Layout proposals" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight">
              Pick a starting layout
            </h2>
            <span className="text-sm text-slate-500">
              {variants.filter((variant) => variant.status === "done").length} of 5 ready
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {variants.map((variant) => {
              const label = archetypeLabel(variant.archetype);
              return (
                <article
                  key={variant.variantIndex}
                  data-testid={`variant-${variant.variantIndex}`}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {variant.status === "done"
                        ? "Ready"
                        : variant.status === "failed"
                          ? "Failed"
                          : "Generating"}
                    </span>
                  </header>

                  {variant.status === "pending" ? (
                    <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
                      Generating this variant…
                    </div>
                  ) : null}

                  {variant.status === "failed" ? (
                    <div className="flex h-[300px] flex-col items-center justify-center gap-3 p-6 text-center">
                      <p className="text-sm text-rose-700">
                        {variant.error || "This variant failed."}
                      </p>
                      <button
                        type="button"
                        onClick={() => retryVariant(variant.variantIndex)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  {variant.status === "done" && variant.html ? (
                    <>
                      <div className="h-[300px] border-b border-slate-100 bg-white">
                        <PreviewFrame
                          html={variant.html}
                          title={`${label} live preview`}
                          scale={0.3}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="text-xs text-slate-500">Live preview</span>
                        <button
                          type="button"
                          onClick={() => pickVariant(variant)}
                          disabled={picking !== null}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                        >
                          {picking === variant.variantIndex
                            ? "Opening…"
                            : "Use this layout"}
                        </button>
                      </div>
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
