import { NextResponse } from "next/server";
import { getAgentById, getScorecardTemplate } from "@/lib/data/datasets";
import { ScorecardTemplate } from "@/lib/types/domain";

type TranscriptTurn = {
  speaker: "rep" | "buyer";
  text: string;
  timestamp?: string;
};

type GenerateScorecardBody = {
  callId?: string;
  agentId?: number;
  transcriptTurns?: TranscriptTurn[];
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as UnknownRecord;
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(stripCodeFence(value)) as T;
  } catch {
    return null;
  }
}

function buildTranscript(turns: TranscriptTurn[]): string {
  return turns
    .map((turn) => `${turn.speaker === "rep" ? "Rep" : "Buyer"}: ${turn.text}`)
    .join("\n");
}

function buildPrompt(args: {
  transcript: string;
  agentName: string;
  rubric: ScorecardTemplate;
}): string {
  const rubricText = args.rubric.sections
    .map((section) => {
      const criteria = section.criteria
        .map((c) => `- ${c.criterion}`)
        .join("\n");
      return `${section.sectionTitle} (max ${section.maxScore})\n${criteria}`;
    })
    .join("\n\n");

  return `
You are an expert B2B sales coach.

Evaluate the sales rep performance from this transcript against the exact rubric sections and criteria.
Buyer persona: ${args.agentName}

Transcript:
${args.transcript}

Rubric:
${rubricText}

Return ONLY valid JSON with this exact shape:
{
  "summary": "string",
  "finalCallScore": number,
  "sections": [
    {
      "sectionTitle": "string",
      "description": "string",
      "maxScore": number,
      "achievedScore": number,
      "totalCriteriaCount": number,
      "passedCriteriaCount": number,
      "criteria": [
        {
          "criterion": "string",
          "passed": boolean,
          "coaching": "string",
          "improvement": "string",
          "explanation": "string"
        }
      ]
    }
  ]
}

Rules:
- Keep section and criterion names aligned to the rubric.
- Be strict but fair.
- coaching and improvement should quote or reference specific behavior from transcript.
- finalCallScore should be 0-100.
`.trim();
}

async function generateWithGemini(
  prompt: string,
  apiKey: string,
): Promise<unknown> {
  const model = process.env.GEMINI_SCORE_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini scorecard failed: ${errorText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const outputText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!outputText) {
    throw new Error("Gemini scorecard response missing text output.");
  }

  const parsed = safeJsonParse<unknown>(outputText);
  if (!parsed) {
    throw new Error("Gemini scorecard response was not valid JSON.");
  }

  return parsed;
}

function normalizeGeneratedScorecard(
  generated: unknown,
  template: ScorecardTemplate,
): ScorecardTemplate {
  const generatedRecord = asRecord(generated);
  const generatedSections = Array.isArray(generatedRecord?.sections)
    ? generatedRecord.sections
    : [];

  const sections = template.sections.map((templateSection) => {
    const matchedSection = generatedSections.find(
      (section) =>
        asRecord(section)?.sectionTitle === templateSection.sectionTitle,
    );
    const matchedSectionRecord = asRecord(matchedSection);
    const generatedCriteria = Array.isArray(matchedSectionRecord?.criteria)
      ? matchedSectionRecord.criteria
      : [];

    const criteria = templateSection.criteria.map((templateCriterion) => {
      const matchedCriterion = generatedCriteria.find(
        (criterion) =>
          asRecord(criterion)?.criterion === templateCriterion.criterion,
      );
      const matchedCriterionRecord = asRecord(matchedCriterion);
      return {
        criterion: templateCriterion.criterion,
        passed: Boolean(matchedCriterionRecord?.passed),
        coaching: String(
          matchedCriterionRecord?.coaching ?? "No coaching provided.",
        ),
        improvement: String(
          matchedCriterionRecord?.improvement ??
            "No improvement notes provided.",
        ),
        explanation: String(matchedCriterionRecord?.explanation ?? ""),
      };
    });

    const passedCriteriaCount = criteria.filter(
      (criterion) => criterion.passed,
    ).length;

    return {
      sectionTitle: templateSection.sectionTitle,
      description: templateSection.description,
      maxScore: templateSection.maxScore,
      achievedScore: passedCriteriaCount,
      totalCriteriaCount: templateSection.totalCriteriaCount,
      passedCriteriaCount,
      criteria,
    };
  });

  const totalCriteria = sections.reduce(
    (sum, section) => sum + section.totalCriteriaCount,
    0,
  );
  const passedCriteria = sections.reduce(
    (sum, section) => sum + section.passedCriteriaCount,
    0,
  );
  const finalCallScore =
    typeof generatedRecord?.finalCallScore === "number"
      ? Math.max(0, Math.min(100, Math.round(generatedRecord.finalCallScore)))
      : totalCriteria > 0
        ? Math.round((passedCriteria / totalCriteria) * 100)
        : 0;

  return {
    scorecardConfigId: template.scorecardConfigId,
    sections,
    totalScore: totalCriteria,
    passedScore: passedCriteria,
    finalCallScore,
    summary: String(generatedRecord?.summary ?? "Generated scorecard summary."),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateScorecardBody;
    const transcriptTurns = Array.isArray(body.transcriptTurns)
      ? body.transcriptTurns.filter(
          (turn): turn is TranscriptTurn =>
            Boolean(turn) &&
            (turn.speaker === "rep" || turn.speaker === "buyer") &&
            typeof turn.text === "string" &&
            turn.text.trim().length > 0,
        )
      : [];

    if (transcriptTurns.length === 0) {
      return NextResponse.json(
        { error: "Transcript is required for scorecard generation." },
        { status: 400 },
      );
    }

    const [template, agent] = await Promise.all([
      getScorecardTemplate(),
      body.agentId ? getAgentById(Number(body.agentId)) : Promise.resolve(null),
    ]);

    const transcript = buildTranscript(transcriptTurns);
    const agentName = agent
      ? `${agent.firstName} ${agent.lastName}`.trim()
      : "Unknown Buyer";
    const prompt = buildPrompt({ transcript, agentName, rubric: template });
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Scorecard generation unavailable.",
          details: "GEMINI_API_KEY is not configured.",
        },
        { status: 503 },
      );
    }

    try {
      const generated = await generateWithGemini(prompt, apiKey);
      const normalized = normalizeGeneratedScorecard(generated, template);

      return NextResponse.json({
        callId: body.callId ?? null,
        scorecard: normalized,
        source: "gemini",
      });
    } catch (generationError) {
      return NextResponse.json(
        {
          error: "Scorecard generation failed.",
          details:
            generationError instanceof Error
              ? generationError.message
              : "Unknown generation error",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("scorecard_generate_unhandled_error", error);
    return NextResponse.json(
      {
        error: "Failed to generate scorecard.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
