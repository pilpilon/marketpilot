"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, X } from "lucide-react";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB — Gemini inline data limit

export interface ReferenceImageData {
  base64: string;
  mimeType: string;
  name: string;
}

interface ReferenceImageUploadProps {
  value: ReferenceImageData | null;
  onChange: (data: ReferenceImageData | null) => void;
  onError?: (message: string) => void;
}

export function ReferenceImageUpload({ value, onChange, onError }: ReferenceImageUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_SIZE) {
        onError?.(`"${file.name}" is too large. Maximum size is 5MB.`);
        return;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        onError?.(`"${file.name}" is not supported. Use PNG, JPG, or WebP.`);
        return;
      }

      setLoading(true);
      try {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        onChange({ base64, mimeType: file.type, name: file.name });
      } catch {
        onError?.("Failed to read file. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [onChange, onError]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFile(files[0]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
      e.target.value = "";
    }
  }

  if (value) {
    return (
      <div className="relative rounded-lg border border-muted-foreground/25 p-2">
        <div className="flex items-center gap-3">
          <img
            src={`data:${value.mimeType};base64,${value.base64}`}
            alt="Reference"
            className="h-16 w-16 rounded object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{value.name}</p>
            <p className="text-xs text-muted-foreground">Reference image</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-1">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Processing...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 py-1">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drop an image here, or{" "}
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
            PNG, JPG, or WebP — max 5MB
          </p>
        </div>
      )}
    </div>
  );
}
