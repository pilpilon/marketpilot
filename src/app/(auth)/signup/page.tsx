"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { CheckCircle2, Zap, Brain, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

const perkIcons = [Brain, Zap, Share2];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const t = useTranslations("signup");

  const perks = [
    { icon: perkIcons[0], text: t("perk1") },
    { icon: perkIcons[1], text: t("perk2") },
    { icon: perkIcons[2], text: t("perk3") },
  ];

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl primary-gradient">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="font-heading text-3xl font-extrabold tracking-tight">{t("checkEmail")}</h2>
            <p className="text-muted-foreground">
              {t("confirmationSent")} <strong className="text-foreground">{email}</strong>
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("alreadyConfirmed")}{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              {t("signIn")}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 primary-gradient p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 -start-20 w-80 h-80 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-1/4 end-0 w-96 h-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-white font-bold text-sm font-heading">
              MP
            </div>
            <span className="font-heading font-bold text-lg text-white tracking-tight">MarketPilot</span>
          </div>
        </div>
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-extrabold text-white tracking-tight leading-tight">
              {t("leftPanelTitle")}
            </h2>
            <p className="text-white/70 leading-relaxed">
              {t("leftPanelSubtitle")}
            </p>
          </div>
          <div className="space-y-4">
            {perks.map((perk) => (
              <div key={perk.text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                  <perk.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-white/90 text-sm font-medium">{perk.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg primary-gradient text-white font-bold text-sm font-heading">
              MP
            </div>
            <span className="font-heading font-bold text-lg tracking-tight">MarketPilot</span>
          </div>

          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-extrabold tracking-tight">{t("createAccount")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">{t("fullName")}</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("fullNamePlaceholder")}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">{t("workEmail")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                className="h-11"
                minLength={6}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
              disabled={loading}
            >
              {loading ? t("creatingAccount") : t("createFreeAccount")}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {t("termsAgreement")}{" "}
            <a href="#" className="underline hover:text-foreground">{t("termsOfService")}</a>
            {" "}{t("and")}{" "}
            <a href="#" className="underline hover:text-foreground">{t("privacyPolicy")}</a>
          </p>

          <p className="text-center text-sm text-muted-foreground">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              {t("signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
