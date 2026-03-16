import { NextResponse } from "next/server";
import { getAgentSummaries } from "@/lib/data/datasets";

export async function GET() {
  try {
    const agents = await getAgentSummaries();
    return NextResponse.json({
      total: agents.length,
      agents,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load agents",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
