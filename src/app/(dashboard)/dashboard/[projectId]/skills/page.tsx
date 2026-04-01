"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AVAILABLE_PLATFORMS = [
  { id: "twitter", label: "X (Twitter)" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
] as const;
import {
  MessageSquare,
  Mail,
  Video,
  CalendarDays,
  ImageIcon,
  Loader2,
  Zap,
  ArrowRight,
  FolderKanban,
  AlertTriangle,
} from "lucide-react";

const TIME_RANGE_OPTIONS = [
  { value: "1_week", labelKey: "timeRange1Week" },
  { value: "2_weeks", labelKey: "timeRange2Weeks" },
  { value: "3_weeks", labelKey: "timeRange3Weeks" },
  { value: "1_month", labelKey: "timeRange1Month" },
] as const;

export default function SkillsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const t = useTranslations("skills");

  // Creative Designer routes directly to its own page
  const DIRECT_SKILLS = [
    {
      id: "creative_designer",
      label: t("creativeDesignerLabel"),
      description: t("creativeDesignerDesc"),
      icon: ImageIcon,
      color: "bg-pink-500/10 text-pink-600",
      href: "skills/creative-designer",
    },
  ];

  const SKILLS = [
    {
      id: "email",
      label: t("emailLabel"),
      description: t("emailDesc"),
      icon: Mail,
      color: "bg-green-500/10 text-green-600",
      options: ["goal", "tone"],
    },
    {
      id: "video_script",
      label: t("videoLabel"),
      description: t("videoDesc"),
      icon: Video,
      color: "bg-purple-500/10 text-purple-600",
      options: ["goal", "tone"],
    },
    {
      id: "content_calendar",
      label: t("calendarLabel"),
      description: t("calendarDesc"),
      icon: CalendarDays,
      color: "bg-orange-500/10 text-orange-600",
      options: ["platforms", "timeRange"],
    },
  ];

  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState({
    count: "5",
    platforms: ["twitter", "instagram"] as string[],
    goal: "",
    tone: "",
    campaignName: "",
    timeRange: "2_weeks",
  });

  // Pipeline progress state
  const [pipelineJobId, setPipelineJobId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<{
    status: string;
    totalPosts: number;
    completedPosts: number;
    currentStep: string;
    campaignId: string;
    error: string | null;
    warnings: string[];
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const skill = SKILLS.find((s) => s.id === selected);

  // Fetch recent campaigns for this project
  type RecentCampaign = {
    id: string;
    name: string;
    campaign_type: string;
    created_at: string;
    campaign_assets: Array<{ id: string }>;
  };
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/campaigns?limit=5`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : { campaigns: [] })
      .then((d) => setRecentCampaigns(d.campaigns || []))
      .catch(() => {});
  }, [projectId]);

  const CAMPAIGN_ICONS: Record<string, React.ElementType> = {
    social_media: MessageSquare,
    email: Mail,
    video_ad: Video,
    content_marketing: CalendarDays,
  };

  // Poll pipeline status
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!pipelineJobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/skills/content-calendar/status?jobId=${pipelineJobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setPipelineStatus(data);

        if (data.status === "completed") {
          stopPolling();
          // Redirect to campaign page after a brief moment
          setTimeout(() => {
            router.push(`/dashboard/${projectId}/campaigns`);
          }, 1500);
        } else if (data.status === "failed") {
          stopPolling();
          setRunning(false);
          setError(data.error || t("failedToRun"));
        }
      } catch {
        // Polling error — just retry next interval
      }
    };

    poll(); // Immediate first poll
    pollRef.current = setInterval(poll, 3000);

    return () => stopPolling();
  }, [pipelineJobId, projectId, router, stopPolling, t]);

  async function runSkill() {
    if (!selected) return;
    setRunning(true);
    setError("");

    // Content Calendar uses the new pipeline endpoint
    if (selected === "content_calendar") {
      return runContentCalendarPipeline();
    }

    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        skillType: selected,
        options: {
          count: parseInt(options.count) || 5,
          platforms: options.platforms,
          goal: options.goal || undefined,
          tone: options.tone || undefined,
          campaignName: options.campaignName || undefined,
        },
      }),
    });

    const data = await res.json();
    setRunning(false);

    if (!res.ok) {
      setError(data.error || t("failedToRun"));
      return;
    }

    router.push(`/dashboard/${projectId}/campaigns/${data.campaign.id}`);
  }

  async function runContentCalendarPipeline() {
    try {
      const res = await fetch("/api/skills/content-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          platforms: options.platforms,
          timeRange: options.timeRange,
          campaignName: options.campaignName || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRunning(false);
        setError(data.error || t("failedToRun"));
        return;
      }

      // Start polling for progress
      setPipelineJobId(data.jobId);
      setPipelineStatus({
        status: "pending",
        totalPosts: 0,
        completedPosts: 0,
        currentStep: t("planningContent"),
        campaignId: data.campaignId,
        error: null,
        warnings: [],
      });
    } catch {
      setRunning(false);
      setError(t("failedToRun"));
    }
  }

  // Pipeline progress UI
  const renderPipelineProgress = () => {
    if (!pipelineStatus) return null;

    const statusStepMap: Record<string, string> = {
      pending: t("planningContent"),
      planning: t("planningContent"),
      generating: t("generatingImages"),
      scheduling: t("schedulingPosts"),
      completed: t("pipelineComplete"),
      failed: t("pipelineFailed"),
    };

    const stepLabel = statusStepMap[pipelineStatus.status] || pipelineStatus.currentStep;
    const progress =
      pipelineStatus.totalPosts > 0
        ? Math.round((pipelineStatus.completedPosts / pipelineStatus.totalPosts) * 100)
        : 0;

    const isComplete = pipelineStatus.status === "completed";
    const isFailed = pipelineStatus.status === "failed";

    return (
      <div className="max-w-lg space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopPolling();
              setPipelineJobId(null);
              setPipelineStatus(null);
              setSelected(null);
              setRunning(false);
              setError("");
            }}
          >
            ← {t("back")}
          </Button>
          <Badge variant="secondary">{t("calendarLabel")}</Badge>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              {!isComplete && !isFailed && (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              {isComplete && (
                <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              {isFailed && <AlertTriangle className="h-5 w-5 text-destructive" />}
              <div>
                <p className="font-semibold">{stepLabel}</p>
                {pipelineStatus.totalPosts > 0 && !isComplete && !isFailed && (
                  <p className="text-sm text-muted-foreground">
                    {pipelineStatus.completedPosts} / {pipelineStatus.totalPosts} {t("assets")}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {pipelineStatus.totalPosts > 0 && (
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isComplete ? "bg-green-500" : isFailed ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${isComplete ? 100 : progress}%` }}
                />
              </div>
            )}

            {/* Warnings */}
            {pipelineStatus.warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 space-y-1">
                {pipelineStatus.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Error */}
            {isFailed && pipelineStatus.error && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{pipelineStatus.error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPipelineJobId(null);
                    setPipelineStatus(null);
                    setRunning(false);
                    setError("");
                  }}
                >
                  {t("back")}
                </Button>
              </div>
            )}

            {isComplete && (
              <p className="text-sm text-muted-foreground">
                {t("redirecting")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Pipeline progress view */}
      {pipelineJobId ? (
        renderPipelineProgress()
      ) : !selected ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {DIRECT_SKILLS.map((s) => (
              <Link key={s.id} href={`/dashboard/${projectId}/${s.href}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardContent className="flex items-start gap-4 p-5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${s.color}`}
                    >
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{s.label}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {s.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
            {SKILLS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className="text-start"
              >
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardContent className="flex items-start gap-4 p-5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${s.color}`}
                    >
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{s.label}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {s.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          {/* Recent campaigns */}
          {recentCampaigns.length > 0 && (
            <div className="space-y-3 mt-8">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  {t("recentGenerations")}
                </h2>
                <Link
                  href={`/dashboard/${projectId}/campaigns`}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  {t("viewAllCampaigns")}
                </Link>
              </div>
              <div className="grid gap-2">
                {recentCampaigns.map((c) => {
                  const Icon = CAMPAIGN_ICONS[c.campaign_type] ?? FolderKanban;
                  return (
                    <Link key={c.id} href={`/dashboard/${projectId}/campaigns/${c.id}`}>
                      <div className="bg-card rounded-lg border border-border px-4 py-3 card-hover flex items-center gap-3 cursor-pointer">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.campaign_assets.length}{" "}{c.campaign_assets.length !== 1 ? t("assets") : t("asset")}
                            {" · "}
                            {new Date(c.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-lg space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelected(null); setError(""); }}
            >
              ← {t("back")}
            </Button>
            <Badge variant="secondary">{skill?.label}</Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("configure", { skill: skill?.label ?? "" })}</CardTitle>
              <CardDescription>{skill?.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {skill?.options.includes("campaignName") || true ? (
                <div className="space-y-1.5">
                  <Label htmlFor="campaignName">{t("campaignNameLabel")}</Label>
                  <Input
                    id="campaignName"
                    placeholder={`${skill?.label} — ${new Date().toLocaleDateString()}`}
                    value={options.campaignName}
                    onChange={(e) =>
                      setOptions({ ...options, campaignName: e.target.value })
                    }
                  />
                </div>
              ) : null}

              {skill?.options.includes("count") && (
                <div className="space-y-1.5">
                  <Label htmlFor="count">{t("numberOfPosts")}</Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={20}
                    value={options.count}
                    onChange={(e) =>
                      setOptions({ ...options, count: e.target.value })
                    }
                  />
                </div>
              )}

              {skill?.options.includes("platforms") && (
                <div className="space-y-2">
                  <Label>{t("platforms")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_PLATFORMS.map((p) => {
                      const checked = options.platforms.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                            checked
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setOptions({
                                ...options,
                                platforms: v
                                  ? [...options.platforms, p.id]
                                  : options.platforms.filter((x) => x !== p.id),
                              });
                            }}
                          />
                          <span className="text-sm font-medium">{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {options.platforms.length === 0 && (
                    <p className="text-xs text-destructive">{t("selectAtLeastOne")}</p>
                  )}
                </div>
              )}

              {skill?.options.includes("timeRange") && (
                <div className="space-y-1.5">
                  <Label>{t("timeRangeLabel")}</Label>
                  <Select
                    value={options.timeRange}
                    onValueChange={(val) => val && setOptions({ ...options, timeRange: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_RANGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("timeRangeHint")}
                  </p>
                </div>
              )}

              {skill?.options.includes("goal") && (
                <div className="space-y-1.5">
                  <Label htmlFor="goal">{t("campaignGoal")}</Label>
                  <Input
                    id="goal"
                    placeholder={t("campaignGoalPlaceholder")}
                    value={options.goal}
                    onChange={(e) =>
                      setOptions({ ...options, goal: e.target.value })
                    }
                  />
                </div>
              )}

              {skill?.options.includes("tone") && (
                <div className="space-y-1.5">
                  <Label htmlFor="tone">{t("toneOverride")}</Label>
                  <Input
                    id="tone"
                    placeholder={t("toneOverridePlaceholder")}
                    value={options.tone}
                    onChange={(e) =>
                      setOptions({ ...options, tone: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("toneHint")}
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={runSkill}
                disabled={running}
                className="w-full primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
              >
                {running ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t("generatingWithAi")}
                  </>
                ) : (
                  <>
                    <Zap className="me-2 h-4 w-4" />
                    {t("runSkill", { skill: skill?.label ?? "" })}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
