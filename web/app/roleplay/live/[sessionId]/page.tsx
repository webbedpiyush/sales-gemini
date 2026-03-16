import Link from "next/link";
import { CallBottomBar } from "@/components/live/CallBottomBar";
import { LiveStage } from "@/components/live/LiveStage";
import { LiveSessionPanel } from "@/components/live/LiveSessionPanel";
import { getAgentById } from "@/lib/data/datasets";

type LivePageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ agentId?: string }>;
};

export default async function LiveRoleplayPage({
  params,
  searchParams,
}: LivePageProps) {
  const { sessionId } = await params;
  const { agentId } = await searchParams;
  const numericId = Number(agentId ?? "28677");
  const agent = Number.isNaN(numericId) ? null : await getAgentById(numericId);

  const buyerName = agent
    ? `${agent.firstName} ${agent.lastName}`.trim()
    : "Unknown Buyer";
  const buyerSubtitle = agent
    ? `${agent.jobTitle} @ ${agent.companyName}`
    : "Buyer Profile";
  const buyerBadge = `${agent?.callType ?? "COLD"} • ${agent?.emotionalState ?? "nice"}`;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Live Session
            </p>
            <h1 className="text-lg font-semibold">Call {sessionId}</h1>
            <p className="mt-1 text-xs text-slate-400">
              Buyer: {buyerName} • {buyerSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {buyerBadge}
            </span>
            <Link
              href="/roleplay"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Change Persona
            </Link>
          </div>
        </header>

        <LiveStage
          buyerName={buyerName}
          buyerSubtitle={buyerSubtitle}
          buyerBadge={buyerBadge}
          repName="You"
        />
        <LiveSessionPanel
          callId={sessionId}
          agentId={agent?.id ?? 28677}
          defaultObjections={agent?.objections ?? []}
        />
        <CallBottomBar callId={sessionId} />
      </div>
    </main>
  );
}
