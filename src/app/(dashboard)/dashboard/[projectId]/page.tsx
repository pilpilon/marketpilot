import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Zap,
  Share2,
  CalendarDays,
  FolderKanban,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Globe,
} from "lucide-react";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) redirect("/dashboard");

  const [
    { data: contextFiles },
    { count: campaignCount },
    { count: assetCount },
    { count: publishedCount },
  ] = await Promise.all([
    supabase.from("context_files").select("file_type").eq("project_id", projectId),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("campaign_assets").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "published"),
  ]);

  const contextFileTypes = new Set(
    (contextFiles || []).map((f: { file_type: string }) => f.file_type)
  );
  const intelligenceComplete = contextFileTypes.size >= 4;

  const REQUIRED_TYPES = ["brand", "product", "audience", "competitors"];
  const missing = REQUIRED_TYPES.filter((t) => !contextFileTypes.has(t));

  const steps = [
    {
      id: "intelligence",
      title: "Brand Intelligence",
      description: "Research your brand, audience & competitors with AI",
      href: `/dashboard/${projectId}/intelligence`,
      icon: Brain,
      done: intelligenceComplete,
      cta: intelligenceComplete ? "View Intelligence" : "Run Analysis",
    },
    {
      id: "skills",
      title: "Skills Engine",
      description: "Generate campaigns, posts, scripts & calendars",
      href: `/dashboard/${projectId}/skills`,
      icon: Zap,
      done: (assetCount ?? 0) > 0,
      cta: "Run Skills",
    },
    {
      id: "social",
      title: "Social Publishing",
      description: "Connect accounts and publish your content",
      href: `/dashboard/${projectId}/social`,
      icon: Share2,
      done: false,
      cta: "Connect Accounts",
    },
    {
      id: "calendar",
      title: "Content Calendar",
      description: "Schedule and manage your content pipeline",
      href: `/dashboard/${projectId}/calendar`,
      icon: CalendarDays,
      done: (publishedCount ?? 0) > 0,
      cta: "Open Calendar",
    },
  ];

  const stats = [
    { label: "Context Files", value: `${contextFileTypes.size}/7`, sub: "types populated" },
    { label: "Campaigns", value: campaignCount ?? 0, sub: "total created" },
    { label: "Published Posts", value: publishedCount ?? 0, sub: "across all platforms" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading text-3xl font-extrabold tracking-tight">
              {project.name as string}
            </h1>
            <Badge
              variant={(project.status as string) === "active" ? "default" : "secondary"}
              className={(project.status as string) === "active" ? "bg-primary/10 text-primary border-primary/20" : ""}
            >
              {project.status as string}
            </Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground">{project.description as string}</p>
          )}
          {project.url && (
            <a
              href={project.url as string}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Globe className="h-3.5 w-3.5" />
              {(project.url as string).replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>

      {/* Intelligence warning */}
      {!intelligenceComplete && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Brand intelligence incomplete
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              Missing: {missing.map((t, i) => (
                <span key={t}>
                  {i > 0 && ", "}
                  <span className="capitalize">{t}</span>
                </span>
              ))}. Run the analyzer to unlock the full skills engine.
            </p>
          </div>
          <Button size="sm" className="primary-gradient text-white border-0 hover:opacity-90 shrink-0" asChild>
            <Link href={`/dashboard/${projectId}/intelligence`}>Run Analysis</Link>
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl border border-border p-6">
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="font-heading text-4xl font-extrabold tracking-tight mt-2 text-primary">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Workflow steps */}
      <div>
        <h2 className="font-heading text-lg font-bold mb-4">Workflow</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step, i) => (
            <Link key={step.id} href={step.href}>
              <div className="bg-card rounded-xl border border-border p-5 card-hover flex items-start gap-4 group">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-heading font-bold text-sm">{step.title}</p>
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium px-1.5 py-0.5 rounded-full bg-muted">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{step.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Campaigns quick link */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold">Campaigns</h2>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/${projectId}/campaigns`}>
            <FolderKanban className="mr-2 h-4 w-4" />
            View all
          </Link>
        </Button>
      </div>
    </div>
  );
}
