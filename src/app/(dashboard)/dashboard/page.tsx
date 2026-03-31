import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban, Zap } from "lucide-react";
import { ProjectCard } from "@/components/dashboard/project-card";
import type { Database } from "@/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];

export default async function DashboardPage() {
  const t = await getTranslations("projects");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const projects = (data || []) as Project[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {projects.length > 0
              ? (projects.length !== 1 ? t("projectCountPlural", { count: projects.length }) : t("projectCount", { count: projects.length }))
              : t("emptySubtitle")}
          </p>
        </div>
        <Button
          className="primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
          asChild
        >
          <Link href="/dashboard/projects/new">
            <Plus className="me-2 h-4 w-4" />
            {t("newProject")}
          </Link>
        </Button>
      </div>

      {projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {/* New project card */}
          <Link href="/dashboard/projects/new">
            <div className="bg-card rounded-xl border border-dashed border-border p-6 min-h-[160px] flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 group-hover:border-primary/50 transition-colors">
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                {t("newProjectCard")}
              </span>
            </div>
          </Link>
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 px-6 bg-card rounded-2xl border border-border text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl primary-gradient mb-6">
            <FolderKanban className="h-8 w-8 text-white" />
          </div>
          <h2 className="font-heading text-2xl font-bold mb-2">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground max-w-sm leading-relaxed mb-8">
            {t("emptyDescription")}
          </p>
          <div className="flex items-center gap-3">
            <Button
              className="primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
              asChild
            >
              <Link href="/dashboard/projects/new">
                <Plus className="me-2 h-4 w-4" />
                {t("createProject")}
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-6 text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            {t("setupTime")}
          </div>
        </div>
      )}
    </div>
  );
}
