"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AgentCard = {
  id: number;
  fullName: string;
  jobTitle: string;
  companyName: string;
  callType: string;
  emotionalState: string;
  language: string;
  industry: string;
};

interface RoleplayCatalogProps {
  agents: AgentCard[];
}

const PAGE_SIZE = 12;

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function RoleplayCatalog({ agents }: RoleplayCatalogProps) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("ALL");
  const [callType, setCallType] = useState("ALL");
  const [emotion, setEmotion] = useState("ALL");
  const [language, setLanguage] = useState("ALL");
  const [page, setPage] = useState(1);

  const industryOptions = useMemo(
    () => ["ALL", ...uniqueSorted(agents.map((agent) => agent.industry))],
    [agents],
  );
  const callTypeOptions = useMemo(
    () => ["ALL", ...uniqueSorted(agents.map((agent) => agent.callType))],
    [agents],
  );
  const emotionOptions = useMemo(
    () => ["ALL", ...uniqueSorted(agents.map((agent) => agent.emotionalState))],
    [agents],
  );
  const languageOptions = useMemo(
    () => ["ALL", ...uniqueSorted(agents.map((agent) => agent.language))],
    [agents],
  );

  const filteredAgents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return agents.filter((agent) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        agent.fullName.toLowerCase().includes(normalizedQuery) ||
        agent.jobTitle.toLowerCase().includes(normalizedQuery) ||
        agent.companyName.toLowerCase().includes(normalizedQuery);
      const matchesIndustry = industry === "ALL" || agent.industry === industry;
      const matchesCallType = callType === "ALL" || agent.callType === callType;
      const matchesEmotion = emotion === "ALL" || agent.emotionalState === emotion;
      const matchesLanguage = language === "ALL" || agent.language === language;
      return (
        matchesQuery &&
        matchesIndustry &&
        matchesCallType &&
        matchesEmotion &&
        matchesLanguage
      );
    });
  }, [agents, callType, emotion, industry, language, query]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pagedAgents = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredAgents.slice(start, start + PAGE_SIZE);
  }, [filteredAgents, safePage]);

  function resetPagination() {
    setPage(1);
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetPagination();
            }}
            placeholder="Search name, title, or company"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-300 focus:ring"
          />

          <select
            value={industry}
            onChange={(event) => {
              setIndustry(event.target.value);
              resetPagination();
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {industryOptions.map((option) => (
              <option key={option} value={option}>
                Industry: {option}
              </option>
            ))}
          </select>

          <select
            value={callType}
            onChange={(event) => {
              setCallType(event.target.value);
              resetPagination();
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {callTypeOptions.map((option) => (
              <option key={option} value={option}>
                Call Type: {option}
              </option>
            ))}
          </select>

          <select
            value={emotion}
            onChange={(event) => {
              setEmotion(event.target.value);
              resetPagination();
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {emotionOptions.map((option) => (
              <option key={option} value={option}>
                Emotion: {option}
              </option>
            ))}
          </select>

          <select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              resetPagination();
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {languageOptions.map((option) => (
              <option key={option} value={option}>
                Language: {option}
              </option>
            ))}
          </select>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Showing {pagedAgents.length} of {filteredAgents.length} matching personas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pagedAgents.map((agent) => (
          <article
            key={agent.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold">{agent.fullName}</h2>
            <p className="mt-1 text-sm text-slate-500">{agent.jobTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{agent.companyName}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-sky-50 px-2 py-1 font-semibold text-sky-700">
                {agent.callType}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                {agent.emotionalState}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                {agent.language}
              </span>
            </div>
            <Link
              href={`/roleplay/live/session-${agent.id}?agentId=${agent.id}`}
              className="mt-5 inline-flex rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Start Call
            </Link>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={safePage <= 1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <p className="text-sm text-slate-600">
          Page {safePage} of {totalPages}
        </p>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          disabled={safePage >= totalPages}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  );
}
