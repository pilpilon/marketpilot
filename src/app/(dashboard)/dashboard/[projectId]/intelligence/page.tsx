"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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

const FILE_TYPE_IDS = [
  { id: "brand", labelKey: "labelBrand", descKey: "descBrand" },
  { id: "product", labelKey: "labelProduct", descKey: "descProduct" },
  { id: "audience", labelKey: "labelAudience", descKey: "descAudience" },
  { id: "competitors", labelKey: "labelCompetitors", descKey: "descCompetitors" },
  { id: "character_brief", labelKey: "labelCharacter", descKey: "descCharacter" },
  { id: "visual_style", labelKey: "labelVisualStyle", descKey: "descVisualStyle" },
  { id: "intake", labelKey: "labelExamples", descKey: "descExamples" },
  { id: "sop", labelKey: "labelSop", descKey: "descSop" },
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
  const t = useTranslations("intelligence");
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;

  const FILE_TYPES = FILE_TYPE_IDS.map((ft) => ({
    id: ft.id,
    label: t(ft.labelKey as any),
    description: t(ft.descKey as any),
  }));
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
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary">
            {t("populated", { count: populatedCount, total: FILE_TYPES.length })}
          </Badge>
          <Button
            onClick={runAnalysis}
            disabled={analyzing}
            className="primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
          >
            {analyzing ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t("analyzing")}
              </>
            ) : (
              <>
                <RefreshCw className="me-2 h-4 w-4" />
                {populatedCount > 0 ? t("reAnalyze") : t("runAnalysis")}
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
            <p className="font-heading font-semibold">{t("onboardingTitle")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("onboardingDescription")}
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
          <Loader2 className="h-6 w-6 animate-spin me-2" />
          {t("loadingIntelligence")}
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
                          <Pencil className="me-2 h-3 w-3" />
                          {t("edit")}
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
                            {t("cancel")}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveFile(ft.id)}
                            disabled={saving[ft.id]}
                          >
                            {saving[ft.id] ? (
                              <Loader2 className="me-2 h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="me-2 h-3 w-3" />
                            )}
                            {t("save")}
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
                                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                                  {t("synthesizingPatterns")}
                                </>
                              ) : (
                                <>
                                  <Wand2 className="me-2 h-4 w-4" />
                                  {file ? t("reSynthesizeExamples") : t("synthesizeExamples")}
                                </>
                              )}
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">
                              {t("synthesizeDescription", { count: attachments.length, plural: attachments.length !== 1 ? "s" : "" })}
                            </p>
                          </div>
                        )}
                        {(attachments.length > 0 || file) && <Separator />}
                      </div>
                    )}

                    {!file && !isEditing ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="font-medium">{t("noDataYet", { label: ft.label })}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {ft.id === "intake"
                            ? t("uploadExamplesHint")
                            : t("runAnalysisHint", { label: ft.label.toLowerCase() })}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-4"
                          onClick={() => setEditMode({ ...editMode, [ft.id]: true })}
                        >
                          <Pencil className="me-2 h-3 w-3" />
                          {t("writeManually")}
                        </Button>
                      </div>
                    ) : isEditing ? (
                      <Textarea
                        value={draft}
                        onChange={(e) =>
                          setDrafts({ ...drafts, [ft.id]: e.target.value })
                        }
                        className="min-h-[400px] font-mono text-sm"
                        placeholder={t("writePlaceholder", { label: ft.label.toLowerCase() })}
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
