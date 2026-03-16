"use client";

import { useEffect, useMemo, useState } from "react";
import { ScorecardTemplate } from "@/lib/types/domain";

type TranscriptTurn = {
  speaker: "rep" | "buyer";
  text: string;
  timestamp: string;
};

type StoredTranscriptPayload = {
  callId: string;
  agentId?: number;
  turns: TranscriptTurn[];
  savedAt: string;
};

interface GeneratedScorecardPanelProps {
  callId: string;
}

export function GeneratedScorecardPanel({ callId }: GeneratedScorecardPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<ScorecardTemplate | null>(null);

  const transcriptStorageKey = useMemo(
    () => `pitchperfect:call:${callId}:transcript`,
    [callId],
  );
  const scoreStorageKey = useMemo(
    () => `pitchperfect:call:${callId}:scorecard`,
    [callId],
  );

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError(null);

      const cached = window.sessionStorage.getItem(scoreStorageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { scorecard?: ScorecardTemplate };
          if (parsed.scorecard && mounted) {
            setScorecard(parsed.scorecard);
            setLoading(false);
            return;
          }
        } catch {
          // Ignore malformed cache and regenerate.
        }
      }

      const transcriptRaw = window.sessionStorage.getItem(transcriptStorageKey);
      if (!transcriptRaw) {
        if (mounted) {
          setError("No transcript found for this call.");
          setScorecard(null);
          setLoading(false);
        }
        return;
      }

      let transcriptPayload: StoredTranscriptPayload | null = null;
      try {
        transcriptPayload = JSON.parse(transcriptRaw) as StoredTranscriptPayload;
      } catch {
        if (mounted) {
          setError("Could not parse transcript data.");
          setScorecard(null);
          setLoading(false);
        }
        return;
      }

      const turns = Array.isArray(transcriptPayload?.turns)
        ? transcriptPayload.turns
        : [];
      if (turns.length === 0) {
        if (mounted) {
          setError("Transcript is empty.");
          setScorecard(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/scorecard/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callId,
            agentId: transcriptPayload?.agentId,
            transcriptTurns: turns,
          }),
        });

        const data = (await response.json()) as {
          error?: string;
          details?: string;
          scorecard?: ScorecardTemplate;
          source?: "gemini";
        };

        if (!response.ok || !data.scorecard) {
          throw new Error(data.error || data.details || "Score generation failed.");
        }

        if (!mounted) return;
        setScorecard(data.scorecard);
        setError(null);
        window.sessionStorage.setItem(
          scoreStorageKey,
          JSON.stringify({
            callId,
            scorecard: data.scorecard,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch (requestError) {
        if (mounted) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : "Score generation failed.";
          setError(message);
          setScorecard(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      mounted = false;
    };
  }, [callId, scoreStorageKey, transcriptStorageKey]);

  return (
    <section>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Scorecard</h2>
          {scorecard ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              Final Score: {scorecard.finalCallScore}/100
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {loading
            ? "Generating scorecard..."
            : scorecard
              ? scorecard.summary
              : "No scorecard generated for this call."}
        </p>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </div>

      {scorecard ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {scorecard.sections.map((section) => (
            <article
              key={section.sectionTitle}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{section.sectionTitle}</h3>
                <span className="text-sm text-slate-500">
                  {section.achievedScore}/{section.maxScore}
                </span>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {section.criteria.map((criterion) => (
                  <li key={criterion.criterion} className="rounded-md bg-slate-50 p-2">
                    <div className="flex items-start gap-2">
                      <span>{criterion.passed ? "✅" : "❌"}</span>
                      <span className="font-medium">{criterion.criterion}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{criterion.coaching}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
