"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FolderKanban,
  Zap,
  MessageSquare,
  Mail,
  Video,
  CalendarDays,
  Trash2,
  Loader2,
  X,
  Clock,
  CheckCircle2,
} from "lucide-react";

const CAMPAIGN_ICONS: Record<string, React.ElementType> = {
  social_media: MessageSquare,
  email: Mail,
  video_ad: Video,
  content_marketing: CalendarDays,
};

const TYPE_LABELS: Record<string, string> = {
  social_media: "Social Media",
  email: "Email",
  video_ad: "Video Ad",
  content_marketing: "Content Marketing",
};

type CampaignRow = {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  goal: string | null;
  platforms: string[];
  created_at: string;
  campaign_assets: Array<{ id: string }>;
  posts?: Array<{ id: string; status: string }>;
  pipelineJob?: { status: string; currentStep: string; totalPosts: number | null; completedPosts: number | null };
};

export function CampaignList({
  campaigns,
  projectId,
}: {
  campaigns: CampaignRow[];
  projectId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const allSelected = campaigns.length > 0 && selected.size === campaigns.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(campaigns.map((c) => c.id)));
    }
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 bg-card rounded-2xl border border-border text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl primary-gradient mb-5">
          <FolderKanban className="h-7 w-7 text-white" />
        </div>
        <h2 className="font-heading text-xl font-bold mb-2">No campaigns yet</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-sm leading-relaxed">
          Run a skill to generate your first campaign — social posts, email sequences, video
          scripts, or a content calendar.
        </p>
        <Button
          className="primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
          asChild
        >
          <Link href={`/dashboard/${projectId}/skills`}>
            <Zap className="me-2 h-4 w-4" />
            Run Skills Engine
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selection toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 animate-in fade-in">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="me-2 h-3.5 w-3.5" />
            )}
            Delete{selected.size > 1 ? ` (${selected.size})` : ""}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            <X className="me-1 h-3.5 w-3.5" />
            Cancel
          </Button>
          <div className="ms-auto">
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
          </div>
        </div>
      )}

      {/* Campaign rows */}
      <div className="grid gap-2">
        {campaigns.map((campaign) => {
          const Icon = CAMPAIGN_ICONS[campaign.campaign_type] ?? FolderKanban;
          const isSelected = selected.has(campaign.id);

          return (
            <div
              key={campaign.id}
              className={`bg-card rounded-xl border p-4 flex items-center gap-4 transition-colors ${
                isSelected ? "border-destructive/30 bg-destructive/5" : "border-border card-hover"
              }`}
            >
              <div
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleOne(campaign.id)}
                />
              </div>

              <Link
                href={`/dashboard/${projectId}/campaigns/${campaign.id}`}
                className="flex-1 flex items-center gap-4 min-w-0 cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-sm truncate">{campaign.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {TYPE_LABELS[campaign.campaign_type] || campaign.campaign_type}
                    </span>
                    {campaign.goal && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {campaign.goal}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {campaign.pipelineJob ? (
                    <Badge variant="outline" className="gap-1.5 border-purple-300 text-purple-600 animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {campaign.pipelineJob.currentStep}
                      {campaign.pipelineJob.totalPosts && campaign.pipelineJob.completedPosts != null
                        ? ` (${campaign.pipelineJob.completedPosts}/${campaign.pipelineJob.totalPosts})`
                        : ""}
                    </Badge>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {campaign.campaign_assets.length} asset
                        {campaign.campaign_assets.length !== 1 ? "s" : ""}
                      </span>
                      {(() => {
                        const posts = campaign.posts || [];
                        const scheduled = posts.filter((p) => p.status === "scheduled").length;
                        const published = posts.filter((p) => p.status === "published").length;
                        return (
                          <>
                            {scheduled > 0 && (
                              <Badge variant="outline" className="gap-1 border-amber-300 text-amber-600">
                                <Clock className="h-3 w-3" />
                                {scheduled} scheduled
                              </Badge>
                            )}
                            {published > 0 && (
                              <Badge variant="outline" className="gap-1 border-green-300 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                {published} published
                              </Badge>
                            )}
                          </>
                        );
                      })()}
                      <Badge
                        variant={campaign.status === "active" ? "default" : "secondary"}
                        className={
                          campaign.status === "active"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : ""
                        }
                      >
                        {campaign.status}
                      </Badge>
                    </>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
