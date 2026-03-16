import { NextResponse } from "next/server";
import { getAgentById } from "@/lib/data/datasets";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  try {
    const agent = await getAgentById(numericId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load agent profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
