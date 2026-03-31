import { NextResponse } from "next/server";

// Meta requires a data deletion callback URL
// This endpoint handles user data deletion requests from Meta
export async function POST(request: Request) {
  const body = await request.json();
  const { signed_request } = body;

  if (!signed_request) {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
  }

  // In production, you would:
  // 1. Parse and verify the signed_request using your app secret
  // 2. Extract the user_id
  // 3. Delete all data associated with that user
  // For now, return a confirmation URL as required by Meta

  const confirmationCode = crypto.randomUUID();

  return NextResponse.json({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

export async function GET() {
  return NextResponse.json({
    message: "To request data deletion, please contact elefantidan@gmail.com or disconnect your account in the MarketPilot dashboard.",
  });
}
