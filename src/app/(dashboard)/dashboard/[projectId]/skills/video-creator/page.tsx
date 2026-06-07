"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Video, ArrowLeft, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import type {
  VideoFramework,
  VideoTemplate,
  VideoLanguage,
  MusicMood,
  VideoJobStatusResponse,
} from "@/lib/video/types";

const FRAMEWORK_OPTIONS: Array<{ value: VideoFramework; labelKey: string }> = [
  { value: "problem_aha_proof_cta", labelKey: "frameworkProblemAha" },
  { value: "pas", labelKey: "frameworkPas" },
  { value: "aida", labelKey: "frameworkAida" },
  { value: "bab", labelKey: "frameworkBab" },
];

const TEMPLATE_OPTIONS: Array<{ value: VideoTemplate; labelKey: string }> = [
  { value: "product_demo", labelKey: "templateProductDemo" },
  { value: "educational", labelKey: "templateEducational" },
  { value: "ugc", labelKey: "templateUgc" },
  { value: "ai_avatar", labelKey: "templateAiAvatar" },
];

const MOOD_OPTIONS: Array<{ value: MusicMood; labelKey: string }> = [
  { value: "upbeat", labelKey: "moodUpbeat" },
  { value: "energetic", labelKey: "moodEnergetic" },
  { value: "corporate", labelKey: "moodCorporate" },
  { value: "chill", labelKey: "moodChill" },
  { value: "cinematic", labelKey: "moodCinematic" },
  { value: "minimal", labelKey: "moodMinimal" },
  { value: "none", labelKey: "moodNone" },
];

const DURATION_OPTIONS = [
  { value: 16, label: "16s (recommended, 2 scenes)" },
  { value: 24, label: "24s (product demo, 3 scenes)" },
  { value: 32, label: "32s (advanced, 4 scenes)" },
];

export default function VideoCreatorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const t = useTranslations("videoCreator");
  const tSkills = useTranslations("skills");

  const [framework, setFramework] = useState<VideoFramework>("problem_aha_proof_cta");
  const [template, setTemplate] = useState<VideoTemplate>("product_demo");
  const [language, setLanguage] = useState<VideoLanguage | "auto">("auto");
  const [durationSeconds, setDurationSeconds] = useState(16);
  const [musicMood, setMusicMood] = useState<MusicMood>("upbeat");
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPassword, setDemoPassword] = useState("");
  const [testingAccess, setTestingAccess] = useState(false);
  const [testAccessStatus, setTestAccessStatus] = useState<{
    ok: boolean;
    message: string;
    finalUrl?: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoJobStatusResponse | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingInFlightRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;

      try {
        const res = await fetch(
          `/api/skills/video-creator/status?jobId=${jobId}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as VideoJobStatusResponse;
        setStatus(data);

        if (data.status === "completed" || data.status === "failed") {
          stopPolling();
        }
      } catch {
        // swallow — retry next tick
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => stopPolling();
  }, [jobId, stopPolling]);

  async function handleTestAccess() {
    setTestingAccess(true);
    setError("");
    setTestAccessStatus(null);

    try {
      const res = await fetch("/api/skills/video-creator/test-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          demoUrl,
          demoEmail: demoEmail || undefined,
          demoPassword: demoPassword || undefined,
        }),
      });
      const data = await res.json();
      setTestAccessStatus({
        ok: Boolean(data.ok),
        message: data.message || data.error || (res.ok ? t("accessTestPassed") : t("accessTestFailed")),
        finalUrl: data.finalUrl,
      });
    } catch {
      setTestAccessStatus({ ok: false, message: t("accessTestFailed") });
    } finally {
      setTestingAccess(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    setStatus(null);

    try {
      const res = await fetch("/api/skills/video-creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          mode: "template",
          language: language === "auto" ? undefined : language,
          durationSeconds,
          framework,
          template,
          musicMood,
          goal: goal || undefined,
          tone: tone || undefined,
          campaignName: campaignName || undefined,
          productDemoAccess:
            template === "product_demo" && demoUrl
              ? {
                  demoUrl,
                  demoEmail: demoEmail || undefined,
                  demoPassword: demoPassword || undefined,
                }
              : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("failedToStart"));
        setSubmitting(false);
        return;
      }

      setJobId(data.jobId);
    } catch {
      setError(t("failedToStart"));
      setSubmitting(false);
    }
  }

  function handleReset() {
    stopPolling();
    setJobId(null);
    setStatus(null);
    setSubmitting(false);
    setError("");
  }

  const isComplete = status?.status === "completed";
  const isFailed = status?.status === "failed";
  const progressPct =
    status && status.totalScenes > 0
      ? Math.round((status.completedScenes / status.totalScenes) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/${projectId}/skills`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 me-1" />
            {tSkills("back")}
          </Button>
        </Link>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Video className="h-6 w-6 text-purple-600" />
          {t("title")}
        </h1>
      </div>

      {!jobId ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{t("configureTitle")}</CardTitle>
            <CardDescription>{t("configureDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("campaignNameLabel")}</Label>
              <Input
                placeholder={`${t("title")} — ${new Date().toLocaleDateString()}`}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("templateLabel")}</Label>
              <Select
                value={template}
                onValueChange={(v) => v && setTemplate(v as VideoTemplate)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("templateHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("frameworkLabel")}</Label>
              <Select
                value={framework}
                onValueChange={(v) => v && setFramework(v as VideoFramework)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRAMEWORK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("frameworkHint")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("durationLabel")}</Label>
                <Select
                  value={String(durationSeconds)}
                  onValueChange={(v) => v && setDurationSeconds(parseInt(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("languageLabel")}</Label>
                <Select
                  value={language}
                  onValueChange={(v) => v && setLanguage(v as VideoLanguage | "auto")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("languageAuto")}</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="he">עברית</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("musicMoodLabel")}</Label>
              <Select
                value={musicMood}
                onValueChange={(v) => v && setMusicMood(v as MusicMood)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {template === "product_demo" && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("demoAccessTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("demoAccessDesc")}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("demoUrlLabel")}</Label>
                  <Input
                    placeholder="https://app.customer.com/login"
                    value={demoUrl}
                    onChange={(e) => {
                      setDemoUrl(e.target.value);
                      setTestAccessStatus(null);
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("demoEmailLabel")}</Label>
                    <Input
                      type="email"
                      placeholder="qa@example.com"
                      value={demoEmail}
                      onChange={(e) => {
                        setDemoEmail(e.target.value);
                        setTestAccessStatus(null);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("demoPasswordLabel")}</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={demoPassword}
                      onChange={(e) => {
                        setDemoPassword(e.target.value);
                        setTestAccessStatus(null);
                      }}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestAccess}
                  disabled={testingAccess || !demoUrl || !demoEmail || !demoPassword}
                  className="w-full"
                >
                  {testingAccess ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t("testingDemoAccess")}
                    </>
                  ) : (
                    t("testDemoAccess")
                  )}
                </Button>
                {testAccessStatus && (
                  <div
                    className={`rounded-md border p-2 text-xs ${
                      testAccessStatus.ok
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {testAccessStatus.ok ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                      )}
                      <div>
                        <p className="font-medium">
                          {testAccessStatus.ok ? t("accessTestPassed") : t("accessTestFailed")}
                        </p>
                        <p>{testAccessStatus.message}</p>
                        {testAccessStatus.finalUrl && <p className="break-all">{testAccessStatus.finalUrl}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">{t("productionStackTitle")}</p>
              <p>{t("productionStackDesc")}</p>
              <p>{t("captionsDefault")}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("goalLabel")}</Label>
              <Input
                placeholder={t("goalPlaceholder")}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("toneLabel")}</Label>
              <Input
                placeholder={t("tonePlaceholder")}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t("starting")}
                </>
              ) : (
                <>
                  <Zap className="me-2 h-4 w-4" />
                  {t("generateVideo")}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {t("estimatedCost")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-2xl">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              {!isComplete && !isFailed && (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {isFailed && <AlertTriangle className="h-5 w-5 text-destructive" />}
              <div className="flex-1">
                <p className="font-semibold">
                  {status?.currentStep || t("queued")}
                </p>
                {status && status.totalScenes > 0 && !isComplete && (
                  <p className="text-sm text-muted-foreground">
                    {status.completedScenes} / {status.totalScenes} {t("scenes")}
                  </p>
                )}
              </div>
            </div>

            {status && status.totalScenes > 0 && (
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isComplete
                      ? "bg-green-500"
                      : isFailed
                        ? "bg-destructive"
                        : "bg-primary"
                  }`}
                  style={{ width: `${isComplete ? 100 : progressPct}%` }}
                />
              </div>
            )}

            {status?.warnings && status.warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 space-y-1">
                {status.warnings.map((w, i) => (
                  <p
                    key={i}
                    className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-1.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            {isFailed && status?.errorMessage && (
              <p className="text-sm text-destructive">{status.errorMessage}</p>
            )}

            {isComplete && status?.finalVideoUrl && (
              <div className="space-y-3">
                <video
                  controls
                  src={status.finalVideoUrl}
                  className="w-full rounded-lg bg-black"
                  style={{ maxHeight: 600 }}
                />
                <p className="text-xs text-muted-foreground">
                  {t("cost", { amount: status.costUsd.toFixed(2) })}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleReset}>
                {t("createAnother")}
              </Button>
              {isComplete && status?.campaignId && (
                <Link
                  href={`/dashboard/${projectId}/campaigns/${status.campaignId}`}
                  className="flex-1"
                >
                  <Button className="w-full">{t("viewCampaign")}</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
