"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, ArrowRight, Globe } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  status: string;
};

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  // Derive initials from project name for the avatar
  const initials = project.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="relative group">
      <Link href={`/dashboard/${project.id}`} className="relative z-0 block">
        <div className="bg-card rounded-xl border border-border p-6 card-hover cursor-pointer flex flex-col gap-4 min-h-[160px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg primary-gradient text-white font-heading font-bold text-sm shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <h3 className="font-heading font-bold text-base tracking-tight truncate">{project.name}</h3>
                {project.url && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                    <Globe className="h-3 w-3 shrink-0" />
                    {project.url.replace(/^https?:\/\//, "")}
                  </p>
                )}
              </div>
            </div>
            <Badge
              variant={project.status === "active" ? "default" : "secondary"}
              className={project.status === "active" ? "bg-primary/10 text-primary border-primary/20 shrink-0" : "shrink-0"}
            >
              {project.status}
            </Badge>
          </div>

          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}

          <div className="flex items-center gap-1 text-xs text-primary font-medium mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
            Open project
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </Link>

      <Button
        variant={confirming ? "destructive" : "ghost"}
        size="sm"
        onClick={handleDelete}
        disabled={deleting}
        className="absolute bottom-3 right-3 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title={confirming ? "Click again to confirm deletion" : "Delete project"}
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : confirming ? (
          <span className="text-xs font-medium">Delete?</span>
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
