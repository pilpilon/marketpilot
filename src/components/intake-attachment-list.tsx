"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Image, Presentation, Download, Trash2, Loader2 } from "lucide-react";

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  public_url: string;
  created_at: string;
}

interface IntakeAttachmentListProps {
  attachments: Attachment[];
  projectId: string;
  onDelete: (attachmentId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mimeType.includes("presentation")) return <Presentation className="h-4 w-4 text-orange-500" />;
  return <FileText className="h-4 w-4 text-red-500" />;
}

export function IntakeAttachmentList({ attachments, projectId, onDelete }: IntakeAttachmentListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  async function handleDelete(attachmentId: string) {
    setDeleting(attachmentId);
    try {
      const res = await fetch(`/api/projects/${projectId}/context/attachments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId }),
      });

      if (res.ok) {
        onDelete(attachmentId);
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Source files ({attachments.length})
      </p>
      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileIcon mimeType={att.file_type} />
            <span className="truncate">{att.file_name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatFileSize(att.file_size)}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              asChild
            >
              <a href={att.public_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => handleDelete(att.id)}
              disabled={deleting === att.id}
            >
              {deleting === att.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
