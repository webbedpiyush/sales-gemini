import { NextResponse } from "next/server";
import { getScorecardTemplate } from "@/lib/data/datasets";

export async function GET() {
  try {
    const scorecardTemplate = await getScorecardTemplate();
    return NextResponse.json({ scorecardTemplate });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load scorecard template",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
