"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AiAssistPanelProps {
  projectId: string;
  onCaptionGenerated: (caption: string) => void;
  onHashtagsGenerated: (hashtags: string[]) => void;
}

export function AiAssistPanel({
  projectId,
  onCaptionGenerated,
  onHashtagsGenerated,
}: AiAssistPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  async function generateCaption() {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt }),
      });

      if (!res.ok) throw new Error("Failed to generate caption");

      const data = await res.json();
      onCaptionGenerated(data.caption);
      toast.success("Caption generated!");
    } catch {
      toast.error("Failed to generate caption. Check your API key.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateHashtags() {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt }),
      });

      if (!res.ok) throw new Error("Failed to generate hashtags");

      const data = await res.json();
      onHashtagsGenerated(data.hashtags);
      toast.success("Hashtags generated!");
    } catch {
      toast.error("Failed to generate hashtags. Check your API key.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Describe what you want to post about... e.g., 'Announce our new feature that lets users track their portfolio in real-time'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generateCaption}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="me-1 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="me-1 h-3 w-3" />
            )}
            Generate Caption
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={generateHashtags}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="me-1 h-3 w-3 animate-spin" />
            ) : (
              <Hash className="me-1 h-3 w-3" />
            )}
            Suggest Hashtags
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
