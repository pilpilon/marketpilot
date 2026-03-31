"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileText, Image, Presentation } from "lucide-react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

interface IntakeFileUploadProps {
  projectId: string;
  onUploadComplete: (data: { attachment: unknown; contextFile: unknown }) => void;
  onError: (message: string) => void;
}

export function IntakeFileUpload({ projectId, onUploadComplete, onError }: IntakeFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) {
      onError(`"${file.name}" is too large. Maximum file size is 20MB.`);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onError(`"${file.name}" is not supported. Accepted: PDF, images (PNG/JPG/WebP), PPTX.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/projects/${projectId}/context/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        onError(data.error || "Upload failed");
        return;
      }

      onUploadComplete(data);
    } catch {
      onError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [projectId, onUploadComplete, onError]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFile(files[0]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
      e.target.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx"
        onChange={handleFileChange}
        className="hidden"
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Uploading & extracting content...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex items-center gap-3 text-muted-foreground">
            <FileText className="h-5 w-5" />
            <Image className="h-5 w-5" />
            <Presentation className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            Drag & drop a file here, or{" "}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => inputRef.current?.click()}
            >
              browse
            </Button>
          </p>
          <p className="text-xs text-muted-foreground/70">
            PDF, images, or PPTX — max 20MB. AI will analyze each example for voice and style patterns.
          </p>
        </div>
      )}
    </div>
  );
}
