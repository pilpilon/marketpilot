import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Restore saved locale preference
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("locale")
          .eq("id", user.id)
          .single();
        if (profile?.locale && profile.locale !== "en") {
          const response = NextResponse.redirect(`${origin}${next}`);
          response.cookies.set("locale", profile.locale, { path: "/", maxAge: 31536000 });
          return response;
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
