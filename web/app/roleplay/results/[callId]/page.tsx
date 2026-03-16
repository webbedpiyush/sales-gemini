import Link from "next/link";
import { GeneratedScorecardPanel } from "@/components/results/GeneratedScorecardPanel";
import { StoredTranscriptPanel } from "@/components/results/StoredTranscriptPanel";
import { TranscriptAnalyticsPanel } from "@/components/results/TranscriptAnalyticsPanel";

type ResultsPageProps = {
  params: Promise<{ callId: string }>;
};

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { callId } = await params;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Roleplay Results</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Call {callId}</h1>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Nice
              </span>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                Cold Call
              </span>
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <Link href="/roleplay" className="text-sm text-sky-700">
              Start New Roleplay
            </Link>
            <Link href="/roleplay/history" className="text-sm text-slate-600">
              View History
            </Link>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_1.4fr]">
          <div className="space-y-5">
            <StoredTranscriptPanel callId={callId} />
          </div>
          <div className="space-y-5">
            <TranscriptAnalyticsPanel callId={callId} />
            <GeneratedScorecardPanel callId={callId} />
          </div>
        </section>
      </div>
    </main>
  );
}
