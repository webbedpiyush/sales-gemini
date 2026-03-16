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

interface TranscriptAnalyticsPanelProps {
  callId: string;
}

const FILLER_PHRASES = [
  "um",
  "uh",
  "like",
  "you know",
  "basically",
  "actually",
  "literally",
  "sort of",
  "kind of",
];

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWords(text: string): number {
  const matches = text.match(/\b[\w']+\b/g);
  return matches ? matches.length : 0;
}

function countFillerPhrases(text: string): number {
  const lower = text.toLowerCase();
  return FILLER_PHRASES.reduce((count, phrase) => {
    const spacedPhrase = escapeRegex(phrase).replace(/\s+/g, "\\s+");
    const regex = new RegExp(`\\b${spacedPhrase}\\b`, "g");
    const matches = lower.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
}

function parseTurns(callId: string): TranscriptTurn[] {
  if (typeof window === "undefined") return [];
  const key = `pitchperfect:call:${callId}:transcript`;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoredTranscriptPayload;
    if (!Array.isArray(parsed.turns)) return [];
    return parsed.turns.filter(
      (turn): turn is TranscriptTurn =>
        Boolean(turn) &&
        (turn.speaker === "rep" || turn.speaker === "buyer") &&
        typeof turn.text === "string" &&
        typeof turn.timestamp === "string",
    );
  } catch {
    return [];
  }
}

function metricTone(value: number, min: number, max: number): {
  label: string;
  className: string;
} {
  if (value >= min && value <= max) {
    return { label: "In range", className: "text-emerald-600" };
  }
  return { label: "Out of range", className: "text-rose-600" };
}

export function TranscriptAnalyticsPanel({ callId }: TranscriptAnalyticsPanelProps) {
  const turns = useMemo(() => parseTurns(callId), [callId]);

  const analytics = useMemo(() => {
    if (turns.length === 0) {
      return null;
    }

    const repTurns = turns.filter((turn) => turn.speaker === "rep");
    const buyerTurns = turns.filter((turn) => turn.speaker === "buyer");

    const repWords = repTurns.reduce((sum, turn) => sum + countWords(turn.text), 0);
    const buyerWords = buyerTurns.reduce((sum, turn) => sum + countWords(turn.text), 0);
    const totalWords = repWords + buyerWords;
    const talkListenRatio = totalWords > 0 ? Math.round((repWords / totalWords) * 100) : 0;

    const sortedTurns = [...turns].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    let repDurationSec = 0;
    let longestRepMonologueSec = 0;

    for (let i = 0; i < sortedTurns.length; i += 1) {
      const current = sortedTurns[i];
      const currentMs = new Date(current.timestamp).getTime();
      const nextMs =
        i < sortedTurns.length - 1
          ? new Date(sortedTurns[i + 1].timestamp).getTime()
          : currentMs + 2000;
      const durationSec = Math.max(
        1,
        Math.min(30, Math.round((nextMs - currentMs) / 1000)),
      );

      if (current.speaker === "rep") {
        repDurationSec += durationSec;
        longestRepMonologueSec = Math.max(longestRepMonologueSec, durationSec);
      }
    }

    const repMinutes = Math.max(repDurationSec / 60, 1 / 60);
    const talkSpeedWpm = Math.round(repWords / repMinutes);
    const fillerCount = repTurns.reduce(
      (sum, turn) => sum + countFillerPhrases(turn.text),
      0,
    );
    const fillerWordsPerMinute = Number((fillerCount / repMinutes).toFixed(2));

    return {
      talkListenRatio,
      talkSpeedWpm,
      fillerWordsPerMinute,
      longestRepMonologueSec,
    };
  }, [turns]);

  if (!analytics) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="mt-2 text-sm text-slate-600">
          Not enough transcript data to compute analytics.
        </p>
      </section>
    );
  }

  const ratioTone = metricTone(analytics.talkListenRatio, 40, 80);
  const speedTone = metricTone(analytics.talkSpeedWpm, 110, 160);
  const fillerTone = metricTone(analytics.fillerWordsPerMinute, 0.6, 3);
  const monologueTone = metricTone(analytics.longestRepMonologueSec, 60, 150);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Analytics</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Talk/Listen Ratio</p>
          <p className="mt-1 text-xl font-semibold">{analytics.talkListenRatio}%</p>
          <p className={`mt-1 text-xs ${ratioTone.className}`}>
            Recommended: 40 to 80 ({ratioTone.label})
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Filler Words</p>
          <p className="mt-1 text-xl font-semibold">
            {analytics.fillerWordsPerMinute} wpm
          </p>
          <p className={`mt-1 text-xs ${fillerTone.className}`}>
            Recommended: 0.6 to 3 ({fillerTone.label})
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Talk Speed</p>
          <p className="mt-1 text-xl font-semibold">{analytics.talkSpeedWpm} wpm</p>
          <p className={`mt-1 text-xs ${speedTone.className}`}>
            Recommended: 110 to 160 ({speedTone.label})
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Longest Monologue</p>
          <p className="mt-1 text-xl font-semibold">
            00:{String(analytics.longestRepMonologueSec).padStart(2, "0")}
          </p>
          <p className={`mt-1 text-xs ${monologueTone.className}`}>
            Recommended: 60 to 150 sec ({monologueTone.label})
          </p>
        </article>
      </div>
    </section>
  );
}
