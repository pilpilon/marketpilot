"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
} from "lucide-react";

// Creative Designer routes directly to its own page
const DIRECT_SKILLS = [
  {
    id: "creative_designer",
    label: "Creative Designer",
    description:
      "Generate on-brand visuals for any post using your brand's visual style, color palette, and character brief — powered by Nano Banana (Gemini image models).",
    icon: ImageIcon,
    color: "bg-pink-500/10 text-pink-600",
    href: "skills/creative-designer",
  },
];

const SKILLS = [
  {
    id: "email",
    label: "Email Campaign",
    description:
      "Write a full nurture email sequence — welcome, education, and conversion — tailored to your audience.",
    icon: Mail,
    color: "bg-green-500/10 text-green-600",
    options: ["goal", "tone"],
  },
  {
    id: "video_script",
    label: "Video Script",
    description:
      "Create a scene-by-scene video ad script with hooks, visuals direction, VO, and CTAs.",
    icon: Video,
    color: "bg-purple-500/10 text-purple-600",
    options: ["goal", "tone"],
  },
  {
    id: "content_calendar",
    label: "Content Calendar",
    description:
      "Build a 4-week content calendar with weekly themes, post types, and platform-specific scheduling.",
    icon: CalendarDays,
    color: "bg-orange-500/10 text-orange-600",
    options: ["platforms", "goal"],
  },
];

export default function SkillsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState({
    count: "5",
    platforms: ["twitter", "instagram"] as string[],
    goal: "",
    tone: "",
    campaignName: "",
  });

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

  async function runSkill() {
    if (!selected) return;
    setRunning(true);
    setError("");

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
      setError(data.error || "Failed to run skill");
      return;
    }

    router.push(`/dashboard/${projectId}/campaigns/${data.campaign.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          Skills Engine
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate marketing assets from your brand intelligence. Each skill uses your full research context.
        </p>
      </div>

      {/* Skill selection */}
      {!selected ? (
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
                className="text-left"
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
                  Recent generations
                </h2>
                <Link
                  href={`/dashboard/${projectId}/campaigns`}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  View all campaigns
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
                            {c.campaign_assets.length} asset{c.campaign_assets.length !== 1 ? "s" : ""}
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
              ← Back
            </Button>
            <Badge variant="secondary">{skill?.label}</Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Configure {skill?.label}</CardTitle>
              <CardDescription>{skill?.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {skill?.options.includes("campaignName") || true ? (
                <div className="space-y-1.5">
                  <Label htmlFor="campaignName">Campaign name (optional)</Label>
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
                  <Label htmlFor="count">Number of posts</Label>
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
                  <Label>Platforms</Label>
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
                    <p className="text-xs text-destructive">Select at least one platform</p>
                  )}
                </div>
              )}

              {skill?.options.includes("goal") && (
                <div className="space-y-1.5">
                  <Label htmlFor="goal">Campaign goal (optional)</Label>
                  <Input
                    id="goal"
                    placeholder="e.g. drive signups, product launch, build awareness"
                    value={options.goal}
                    onChange={(e) =>
                      setOptions({ ...options, goal: e.target.value })
                    }
                  />
                </div>
              )}

              {skill?.options.includes("tone") && (
                <div className="space-y-1.5">
                  <Label htmlFor="tone">Tone override (optional)</Label>
                  <Input
                    id="tone"
                    placeholder="e.g. more casual, more technical, more urgent"
                    value={options.tone}
                    onChange={(e) =>
                      setOptions({ ...options, tone: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use your brand character brief
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating with AI…
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Run {skill?.label} Skill
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
