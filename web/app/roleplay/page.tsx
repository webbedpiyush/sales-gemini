import Link from "next/link";
import { RoleplayCatalog } from "@/components/roleplay/RoleplayCatalog";
import { getAgentSummaries } from "@/lib/data/datasets";

export default async function RoleplaySetupPage() {
  const summaries = await getAgentSummaries();
  const uniqueByAgentId = new Map<number, (typeof summaries)[number]>();

  for (const summary of summaries) {
    if (!uniqueByAgentId.has(summary.id)) {
      uniqueByAgentId.set(summary.id, summary);
    }
  }

  const allAgents = Array.from(uniqueByAgentId.values());

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            PitchPerfect AI
          </p>
          <h1 className="mt-2 text-3xl font-bold">Choose Buyer Persona</h1>
          <p className="mt-2 text-slate-600">
            Select a buyer profile to start a live voice roleplay session.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {allAgents.length} personas available
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Voice roleplay ready
            </span>
            <Link
              href="/roleplay/history"
              className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
            >
              View roleplay history
            </Link>
          </div>
        </header>

        <RoleplayCatalog agents={allAgents} />
      </div>
    </main>
  );
}
