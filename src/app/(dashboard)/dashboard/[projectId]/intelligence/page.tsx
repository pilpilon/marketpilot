"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Brain,
  Loader2,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Wand2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { IntakeFileUpload } from "@/components/intake-file-upload";
import { IntakeAttachmentList } from "@/components/intake-attachment-list";

const FILE_TYPES = [
  {
    id: "brand",
    label: "Brand",
    description: "Positioning, promise, pillars, differentiators, voice & tone",
  },
  {
    id: "product",
    label: "Product",
    description: "Value proposition, features, use cases, proof points",
  },
  {
    id: "audience",
    label: "Audience",
    description: "Buyer personas, pain points, channels, objections",
  },
  {
    id: "competitors",
    label: "Competitors",
    description: "Competitive landscape, positioning gaps, market dynamics",
  },
  {
    id: "character_brief",
    label: "Character",
    description: "Brand personality, tone examples, content themes, hashtags",
  },
  {
    id: "visual_style",
    label: "Visual Style",
    description: "Color direction, typography, imagery, composition guidance",
  },
  {
    id: "intake",
    label: "Examples",
    description: "Upload past successful posts, campaigns, and presentations — AI learns your voice and style patterns",
  },
  {
    id: "sop",
    label: "SOP",
    description: "Standard operating procedure for the research & analysis workflow",
  },
];

type ContextFile = {
  id: string;
  file_type: string;
  content: string;
  source: string;
  version: number;
  updated_at: string;
};

type Attachment = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  public_url: string;
  created_at: string;
};

export default function IntelligencePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const isOnboarding = searchParams.get("onboarding") === "true";

  const [files, setFiles] = useState<Record<string, ContextFile>>({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("brand");
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [analyzeError, setAnalyzeError] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesizeError, setSynthesizeError] = useState("");

  const fetchFiles = useCallback(async () => {
    const [contextRes, attachRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/context`),
      fetch(`/api/projects/${projectId}/context/attachments`),
    ]);
    const contextData = await contextRes.json();
    const attachData = await attachRes.json();
    const map: Record<string, ContextFile> = {};
    for (const f of contextData.files || []) {
      map[f.file_type] = f;
    }
    setFiles(map);
    setAttachments(attachData.attachments || []);
    setLoading(false);
  }, [projectId]);

  // Poll analysis_runs status every 3s while analyzing
  const pollStatus = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/analyze`);
    const data = await res.json();
    const run = data.run as { status: string; error_message?: string } | null;
    if (!run || run.status === "completed") {
      await fetchFiles();
      setAnalyzing(false);
    } else if (run.status === "failed") {
      setAnalyzeError(run.error_message || "Analysis failed");
      setAnalyzing(false);
    }
    // still "running" — caller will poll again
    return run?.status ?? null;
  }, [projectId, fetchFiles]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function init() {
      // Check if an analysis is already running (e.g. user navigated away mid-run)
      const res = await fetch(`/api/projects/${projectId}/analyze`);
      const data = await res.json();
      const run = data.run as { status: string } | null;
      if (run?.status === "running") {
        setAnalyzing(true);
        schedulePoll();
      } else {
        await fetchFiles();
      }
    }

    function schedulePoll() {
      timer = setTimeout(async () => {
        const status = await pollStatus();
        if (status === "running") schedulePoll();
      }, 3000);
    }

    init();
    return () => clearTimeout(timer);
  }, [projectId, fetchFiles, pollStatus]);

  function runAnalysis() {
    setAnalyzing(true);
    setAnalyzeError("");

    // Fire the POST — server runs to completion even if client navigates away
    fetch(`/api/projects/${projectId}/analyze`, { method: "POST" }).catch(() => {});

    // Poll for completion
    let timer: ReturnType<typeof setTimeout>;
    function poll() {
      timer = setTimeout(async () => {
        const status = await pollStatus();
        if (status === "running") poll();
      }, 3000);
    }
    poll();
  }

  async function saveFile(fileType: string) {
    setSaving({ ...saving, [fileType]: true });
    const content = drafts[fileType] ?? files[fileType]?.content ?? "";

    const res = await fetch(`/api/projects/${projectId}/context`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileType, content }),
    });

    const data = await res.json();
    setSaving({ ...saving, [fileType]: false });

    if (res.ok) {
      setFiles({ ...files, [fileType]: data.file });
      setEditMode({ ...editMode, [fileType]: false });
      setDrafts({ ...drafts, [fileType]: "" });
    }
  }

  async function synthesizeExamples() {
    setSynthesizing(true);
    setSynthesizeError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/context/synthesize-examples`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Synthesis failed");
      const cf = data.contextFile as ContextFile;
      if (cf) {
        setFiles({ ...files, intake: cf });
        setEditMode({ ...editMode, intake: false });
        setDrafts({ ...drafts, intake: "" });
      }
    } catch (err) {
      setSynthesizeError(err instanceof Error ? err.message : "Synthesis failed");
    } finally {
      setSynthesizing(false);
    }
  }

  const populatedCount = FILE_TYPES.filter((t) => files[t.id]).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Brand Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-researched context that powers every skill, caption, and campaign.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary">
            {populatedCount}/{FILE_TYPES.length} populated
          </Badge>
          <Button
            onClick={runAnalysis}
            disabled={analyzing}
            className="primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {populatedCount > 0 ? "Re-analyze" : "Run Analysis"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Onboarding callout */}
      {isOnboarding && populatedCount === 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-start gap-3">
          <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-heading font-semibold">Start by running the AI analysis</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              MarketPilot will research your brand, competitors, and target audience using Perplexity + Gemini — then generate a full intelligence brief. This takes about 30 seconds.
            </p>
          </div>
        </div>
      )}

      {analyzeError && (
        <div className="flex items-center gap-2 text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {analyzeError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading intelligence…
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            {FILE_TYPES.map((ft) => (
              <TabsTrigger key={ft.id} value={ft.id} className="gap-1.5">
                {ft.label}
                {files[ft.id] && (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {FILE_TYPES.map((ft) => {
            const file = files[ft.id];
            const isEditing = editMode[ft.id];
            const draft = drafts[ft.id] ?? file?.content ?? "";

            return (
              <TabsContent key={ft.id} value={ft.id} className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>{ft.label}</CardTitle>
                      <CardDescription className="mt-0.5">
                        {ft.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {file && (
                        <Badge variant="outline" className="text-xs">
                          v{file.version} · {file.source}
                        </Badge>
                      )}
                      {file && !isEditing && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditMode({ ...editMode, [ft.id]: true })
                          }
                        >
                          <Pencil className="mr-2 h-3 w-3" />
                          Edit
                        </Button>
                      )}
                      {isEditing && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditMode({ ...editMode, [ft.id]: false });
                              setDrafts({ ...drafts, [ft.id]: "" });
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveFile(ft.id)}
                            disabled={saving[ft.id]}
                          >
                            {saving[ft.id] ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-3 w-3" />
                            )}
                            Save
                          </Button>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Examples Library: upload zone + attachment list + synthesize */}
                    {ft.id === "intake" && (
                      <div className="space-y-3 mb-4">
                        <IntakeFileUpload
                          projectId={projectId}
                          onUploadComplete={(data) => {
                            setUploadError("");
                            const att = data.attachment as Attachment;
                            if (att) {
                              setAttachments((prev) => [att, ...prev]);
                            }
                          }}
                          onError={(msg) => setUploadError(msg)}
                        />
                        {uploadError && (
                          <div className="flex items-center gap-2 text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {uploadError}
                          </div>
                        )}
                        <IntakeAttachmentList
                          attachments={attachments}
                          projectId={projectId}
                          onDelete={(id) =>
                            setAttachments((prev) => prev.filter((a) => a.id !== id))
                          }
                        />
                        {attachments.length > 0 && (
                          <div className="space-y-2">
                            {synthesizeError && (
                              <div className="flex items-center gap-2 text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {synthesizeError}
                              </div>
                            )}
                            <Button
                              onClick={synthesizeExamples}
                              disabled={synthesizing}
                              className="w-full"
                            >
                              {synthesizing ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Synthesizing patterns…
                                </>
                              ) : (
                                <>
                                  <Wand2 className="mr-2 h-4 w-4" />
                                  {file ? "Re-synthesize Examples" : "Synthesize Examples"}
                                </>
                              )}
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">
                              Analyzes all {attachments.length} example{attachments.length !== 1 ? "s" : ""} and generates a unified Voice & Style DNA brief
                            </p>
                          </div>
                        )}
                        {(attachments.length > 0 || file) && <Separator />}
                      </div>
                    )}

                    {!file && !isEditing ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="font-medium">No {ft.label} data yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {ft.id === "intake"
                            ? "Upload examples above, then click Synthesize Examples to generate your style brief."
                            : `Run the analysis above or manually write your ${ft.label.toLowerCase()} brief.`}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-4"
                          onClick={() => setEditMode({ ...editMode, [ft.id]: true })}
                        >
                          <Pencil className="mr-2 h-3 w-3" />
                          Write manually
                        </Button>
                      </div>
                    ) : isEditing ? (
                      <Textarea
                        value={draft}
                        onChange={(e) =>
                          setDrafts({ ...drafts, [ft.id]: e.target.value })
                        }
                        className="min-h-[400px] font-mono text-sm"
                        placeholder={`Write your ${ft.label.toLowerCase()} brief here…`}
                      />
                    ) : (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                          {file?.content}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
