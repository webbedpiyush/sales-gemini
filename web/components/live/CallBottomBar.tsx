"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

interface CallBottomBarProps {
  callId: string;
}

export function CallBottomBar({ callId }: CallBottomBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((previous) => previous + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mt-5 flex items-center justify-center gap-8 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
      <p className="text-2xl font-semibold tabular-nums">{formatSeconds(elapsed)}</p>
      <Link
        href={`/roleplay/results/${callId}`}
        className="rounded-xl bg-rose-500 px-7 py-3 text-sm font-semibold transition hover:bg-rose-400"
      >
        End Call
      </Link>
    </div>
  );
}
