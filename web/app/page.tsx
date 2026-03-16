import { getAgentSummaries, getScorecardTemplate } from "@/lib/data/datasets";
import Link from "next/link";

export default async function Home() {
  const [agents, scorecard] = await Promise.all([
    getAgentSummaries(),
    getScorecardTemplate(),
  ]);
  const sampleAgents = agents.slice(0, 6);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
            PitchPerfect AI
          </p>
          <h1 className="mt-2 text-3xl font-bold">Step 2: Data Layer Ready</h1>
          <p className="mt-2 text-slate-300">
            Agent and scorecard data are loaded from your source JSON files and
            exposed through API routes.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total agent variants</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-300">
              {agents.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Scorecard sections</p>
            <p className="mt-2 text-3xl font-semibold text-violet-300">
              {scorecard.sections.length}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">Sample agents</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            {sampleAgents.map((agent) => (
              <li
                key={`${agent.id}-${agent.emotionalState}-${agent.callType}`}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
              >
                {agent.fullName} - {agent.jobTitle} @ {agent.companyName} (
                {agent.callType}, {agent.emotionalState})
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">API endpoints</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            <li>/api/agents</li>
            <li>/api/agents/28677</li>
            <li>/api/scorecard-template</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">Step 3 routes</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/roleplay" className="rounded-lg bg-sky-500 px-3 py-2 text-slate-950">
              /roleplay
            </Link>
            <Link
              href="/roleplay/live/session-28677?agentId=28677"
              className="rounded-lg bg-slate-800 px-3 py-2"
            >
              /roleplay/live/session-28677
            </Link>
            <Link
              href="/roleplay/results/session-28677"
              className="rounded-lg bg-slate-800 px-3 py-2"
            >
              /roleplay/results/session-28677
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
