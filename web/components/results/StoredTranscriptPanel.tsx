"use client";

import { useMemo } from "react";

type TranscriptTurn = {
  speaker: "rep" | "buyer";
  text: string;
  timestamp: string;
};

type StoredTranscriptPayload = {
  callId: string;
  turns: TranscriptTurn[];
  savedAt: string;
};

interface StoredTranscriptPanelProps {
  callId: string;
}

export function StoredTranscriptPanel({ callId }: StoredTranscriptPanelProps) {
  const storageKey = useMemo(() => `pitchperfect:call:${callId}:transcript`, [callId]);

  const turns = useMemo(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as StoredTranscriptPayload;
      return Array.isArray(parsed.turns) ? parsed.turns : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Transcript</h2>
        <span className="text-xs text-slate-500">{turns.length} turns</span>
      </div>
      {turns.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          No transcript turns found for this call yet.
        </p>
      ) : (
        <ul className="max-h-[520px] space-y-3 overflow-auto pr-1">
          {turns.map((turn, index) => (
            <li
              key={`${turn.speaker}-${turn.timestamp}-${index}`}
              className={`rounded-lg border p-3 ${
                turn.speaker === "rep"
                  ? "border-sky-100 bg-sky-50/60"
                  : "border-emerald-100 bg-emerald-50/60"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {turn.speaker === "rep" ? "Rep" : "Buyer"}
              </p>
              <p className="mt-1 text-sm text-slate-800">{turn.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
