import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  try {
    const res = await fetch(`${backendUrl}/api/hotels/${encodeURIComponent(id)}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Hotel not found" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch hotel details" },
      { status: 502 }
    );
  }
}
