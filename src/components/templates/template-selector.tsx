"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ContentTemplate, TemplateCategory } from "@/types/templates";
import { SYSTEM_TEMPLATES } from "@/lib/templates/system-templates";
import { TemplateCard } from "./template-card";
import { cn } from "@/lib/utils";

interface TemplateSelectorProps {
  onSelect: (template: ContentTemplate) => void;
}

const CATEGORY_TAB_KEYS: Array<{ value: TemplateCategory | "all"; key: string }> = [
  { value: "all", key: "categoryAll" },
  { value: "promotional", key: "categoryPromotional" },
  { value: "educational", key: "categoryEducational" },
  { value: "quote", key: "categoryQuote" },
  { value: "announcement", key: "categoryAnnouncement" },
  { value: "product_showcase", key: "categoryProduct" },
  { value: "testimonial", key: "categoryTestimonial" },
];

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const t = useTranslations("creativeDesigner");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");

  const filtered =
    category === "all"
      ? SYSTEM_TEMPLATES
      : SYSTEM_TEMPLATES.filter((t) => t.category === category);

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {CATEGORY_TAB_KEYS.map((tab) => (
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
            {t(tab.key as any)}
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
