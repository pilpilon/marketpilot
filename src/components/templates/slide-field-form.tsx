"use client";

import type { SlideDefinition } from "@/types/templates";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SlideFieldFormProps {
  slide: SlideDefinition;
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
}

export function SlideFieldForm({ slide, values, onChange }: SlideFieldFormProps) {
  return (
    <div className="space-y-3">
      {slide.fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <Label htmlFor={`${slide.id}-${field.id}`} className="text-sm">
            {field.label}
            {!field.required && (
              <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
            )}
          </Label>
          {field.type === "textarea" ? (
            <Textarea
              id={`${slide.id}-${field.id}`}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              rows={2}
              value={values[field.id] || ""}
              onChange={(e) => onChange(field.id, e.target.value)}
            />
          ) : (
            <Input
              id={`${slide.id}-${field.id}`}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              value={values[field.id] || ""}
              onChange={(e) => onChange(field.id, e.target.value)}
            />
          )}
          {field.maxLength && values[field.id] && (
            <p className="text-[10px] text-muted-foreground text-right">
              {values[field.id].length}/{field.maxLength}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
