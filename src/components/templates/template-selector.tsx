"use client";

import { useState } from "react";
import type { ContentTemplate, TemplateCategory } from "@/types/templates";
import { SYSTEM_TEMPLATES } from "@/lib/templates/system-templates";
import { TemplateCard } from "./template-card";
import { cn } from "@/lib/utils";

interface TemplateSelectorProps {
  onSelect: (template: ContentTemplate) => void;
}

const CATEGORY_TABS: Array<{ value: TemplateCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "promotional", label: "Promotional" },
  { value: "educational", label: "Educational" },
  { value: "quote", label: "Quote" },
  { value: "announcement", label: "Announcement" },
  { value: "product_showcase", label: "Product" },
  { value: "testimonial", label: "Testimonial" },
];

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [category, setCategory] = useState<TemplateCategory | "all">("all");

  const filtered =
    category === "all"
      ? SYSTEM_TEMPLATES
      : SYSTEM_TEMPLATES.filter((t) => t.category === category);

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setCategory(tab.value)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              category === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={onSelect}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No templates in this category yet.
        </div>
      )}
    </div>
  );
}
