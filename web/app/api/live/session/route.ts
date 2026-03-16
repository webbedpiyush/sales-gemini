import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAgentById } from "@/lib/data/datasets";
import { buildSystemInstruction } from "@/lib/prompts/systemInstruction";
import { LiveSessionBootstrap } from "@/lib/types/domain";

const DEFAULT_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const DEFAULT_VOICE = "Puck";

type SessionPayload = {
  agentId?: number;
  runtimeObjections?: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SessionPayload;
    const agentId = Number(body.agentId);
    const runtimeObjections = Array.isArray(body.runtimeObjections)
      ? body.runtimeObjections.filter((item): item is string => typeof item === "string")
      : [];

    if (Number.isNaN(agentId)) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const agent = await getAgentById(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const systemInstruction = buildSystemInstruction(agent, runtimeObjections);
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

    const response: LiveSessionBootstrap = {
      sessionId: randomUUID(),
      agentId,
      model: DEFAULT_MODEL,
      responseModalities: ["AUDIO"],
      voiceName: DEFAULT_VOICE,
      systemInstruction,
      transport: "sdk-server",
      status: hasApiKey ? "ready" : "missing_api_key",
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create live session bootstrap",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
