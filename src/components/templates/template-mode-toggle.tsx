"use client";

import { cn } from "@/lib/utils";
import { ImageIcon, LayoutTemplate } from "lucide-react";

interface TemplateModeToggleProps {
  mode: "freeform" | "template";
  onModeChange: (mode: "freeform" | "template") => void;
}

export function TemplateModeToggle({ mode, onModeChange }: TemplateModeToggleProps) {
  return (
    <div className="flex rounded-lg border bg-muted p-1 gap-1">
      <button
        onClick={() => onModeChange("freeform")}
        className={cn(
          "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
          mode === "freeform"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ImageIcon className="h-4 w-4" />
        Freeform
      </button>
      <button
        onClick={() => onModeChange("template")}
        className={cn(
          "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
          mode === "template"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutTemplate className="h-4 w-4" />
        Templates
      </button>
    </div>
  );
}
