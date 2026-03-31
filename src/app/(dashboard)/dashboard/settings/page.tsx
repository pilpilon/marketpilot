"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Globe, LogOut } from "lucide-react";

function getLocaleCookie(): "en" | "he" {
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
  return match?.[1] === "he" ? "he" : "en";
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const supabase = createClient();
  const [locale, setLocale] = useState<"en" | "he">("en");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setLocale(getLocaleCookie());
  }, []);

  async function handleLocaleChange(newLocale: "en" | "he") {
    if (newLocale === locale) return;

    // Set cookie for immediate server-side access
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;

    // Persist to DB (non-blocking)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        (supabase.from("profiles") as any).update({ locale: newLocale }).eq("id", user.id).then(() => {});
      }
    });

    // Full reload needed because dir/lang are set in root layout server-side
    window.location.reload();
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    document.cookie = "locale=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        {t("title")}
      </h1>

      {/* Language */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="font-heading text-base font-semibold">{t("language")}</h2>
            <p className="text-sm text-muted-foreground">{t("languageDescription")}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant={locale === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => handleLocaleChange("en")}
            className={locale === "en" ? "primary-gradient text-white border-0" : ""}
          >
            English
          </Button>
          <Button
            variant={locale === "he" ? "default" : "outline"}
            size="sm"
            onClick={() => handleLocaleChange("he")}
            className={locale === "he" ? "primary-gradient text-white border-0" : ""}
          >
            עברית
          </Button>
        </div>
      </div>

      {/* Logout */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
            <LogOut className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="font-heading text-base font-semibold">{t("logout")}</h2>
            <p className="text-sm text-muted-foreground">{t("logoutDescription")}</p>
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <LogOut className="me-2 h-4 w-4" />
            {loggingOut ? "..." : t("logout")}
          </Button>
        </div>
      </div>
    </div>
  );
}
