import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  AgentProfile,
  AgentResearch,
  AgentSummary,
  ScoreSection,
  ScorecardTemplate,
} from "@/lib/types/domain";

type UnknownRecord = Record<string, unknown>;

type RawCatalogEntry = {
  industry?: string;
  agentId?: number;
  agent?: UnknownRecord;
};

type RawCatalog = Record<string, RawCatalogEntry[]>;

const DATA_FILES = {
  agents: "agents.json",
  scorecard: "scorecard.json",
};

const jsonCache = new Map<string, unknown>();

async function resolveDataPath(fileName: string): Promise<string> {
  const candidates = [
    path.join(process.cwd(), fileName),
    path.join(process.cwd(), "..", fileName),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next candidate path.
    }
  }

  throw new Error(`Unable to locate data file: ${fileName}`);
}

async function loadJson<T>(fileName: string): Promise<T> {
  if (jsonCache.has(fileName)) {
    return jsonCache.get(fileName) as T;
  }

  const absolutePath = await resolveDataPath(fileName);
  const content = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(content) as T;
  jsonCache.set(fileName, parsed);
  return parsed;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function parseResearch(value: unknown): AgentResearch | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as AgentResearch;
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value as AgentResearch;
  }

  return null;
}

function normalizeAgent(rawAgent: UnknownRecord): AgentProfile {
  const firstName = String(rawAgent.firstName ?? "");
  const lastName = String(rawAgent.lastName ?? "");
  const callTypeRaw = String(rawAgent.callType ?? "");
  const emotionalStateRaw = String(rawAgent.emotionalState ?? "");

  return {
    id: Number(rawAgent.id ?? 0),
    firstName,
    lastName,
    jobTitle: String(rawAgent.jobTitle ?? ""),
    companyName: String(rawAgent.companyName ?? ""),
    openerLine: String(rawAgent.openerLine ?? ""),
    emotionalState: emotionalStateRaw.toLowerCase(),
    callType: callTypeRaw.toUpperCase(),
    language: String(rawAgent.language ?? "en-US"),
    description: String(rawAgent.description ?? ""),
    personalDetails: asStringArray(rawAgent.personalDetails),
    companyDetails: asStringArray(rawAgent.companyDetails),
    companyOrgStructure: asStringArray(rawAgent.companyOrgStructure),
    goals: asStringArray(rawAgent.goals),
    opinions: asStringArray(rawAgent.opinions),
    objections: asStringArray(rawAgent.objections),
    research: parseResearch(rawAgent.research),
  };
}

async function getCatalog(): Promise<RawCatalog> {
  return loadJson<RawCatalog>(DATA_FILES.agents);
}

export async function getAgentSummaries(): Promise<AgentSummary[]> {
  const catalog = await getCatalog();
  const summaries: AgentSummary[] = [];

  for (const entries of Object.values(catalog)) {
    for (const entry of entries) {
      if (!entry.agent || typeof entry.agent !== "object") {
        continue;
      }

      const normalized = normalizeAgent(entry.agent);
      summaries.push({
        id: normalized.id || Number(entry.agentId ?? 0),
        fullName: `${normalized.firstName} ${normalized.lastName}`.trim(),
        jobTitle: normalized.jobTitle,
        companyName: normalized.companyName,
        callType: normalized.callType,
        emotionalState: normalized.emotionalState,
        language: normalized.language,
        industry: String(entry.industry ?? ""),
      });
    }
  }

  return summaries.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getAgentById(agentId: number): Promise<AgentProfile | null> {
  const catalog = await getCatalog();

  for (const entries of Object.values(catalog)) {
    for (const entry of entries) {
      const rawAgent = entry.agent;
      if (!rawAgent || typeof rawAgent !== "object") {
        continue;
      }

      const normalized = normalizeAgent(rawAgent);
      if (normalized.id === agentId || Number(entry.agentId ?? -1) === agentId) {
        return normalized;
      }
    }
  }

  return null;
}

function normalizeScoreSection(raw: UnknownRecord): ScoreSection {
  const rawCriteria = Array.isArray(raw.criteria) ? raw.criteria : [];

  return {
    sectionTitle: String(raw.sectionTitle ?? ""),
    description: String(raw.description ?? ""),
    maxScore: Number(raw.maxScore ?? 0),
    achievedScore: Number(raw.achievedScore ?? 0),
    totalCriteriaCount: Number(raw.totalCriteriaCount ?? rawCriteria.length),
    passedCriteriaCount: Number(raw.passedCriteriaCount ?? 0),
    criteria: rawCriteria
      .filter((criterion): criterion is UnknownRecord => Boolean(criterion))
      .map((criterion) => ({
        passed: Boolean(criterion.passed),
        criterion: String(criterion.criterion ?? ""),
        explanation: String(criterion.explanation ?? ""),
        coaching: String(criterion.coaching ?? ""),
        improvement: String(criterion.improvement ?? ""),
      })),
  };
}

export async function getScorecardTemplate(): Promise<ScorecardTemplate> {
  const raw = await loadJson<UnknownRecord>(DATA_FILES.scorecard);
  const rawSections = Array.isArray(raw.scorecards) ? raw.scorecards : [];
  const sections = rawSections
    .filter((section): section is UnknownRecord => Boolean(section))
    .map(normalizeScoreSection);

  return {
    scorecardConfigId: Number(raw.scorecardConfigId ?? 0),
    sections,
    totalScore: Number(raw.totalScore ?? 0),
    passedScore: Number(raw.passedScore ?? 0),
    finalCallScore: Number(raw.finalCallScore ?? 0),
    summary: String((raw.metadata as UnknownRecord | undefined)?.summary ?? ""),
  };
}
