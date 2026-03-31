"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Globe, Loader2, Zap, Plus, X, Share2, Link2, Hash, Play } from "lucide-react";
import type { BrandUrlType } from "@/types/database";

const SOCIAL_OPTIONS: { value: BrandUrlType; label: string; placeholder: string }[] = [
  { value: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourbrand" },
  { value: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourbrand" },
  { value: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/yourbrand" },
  { value: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourbrand" },
  { value: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourbrand" },
  { value: "other", label: "Other URL", placeholder: "https://..." },
];

function SocialIcon({ type, className }: { type: BrandUrlType; className?: string }) {
  switch (type) {
    case "facebook":
      return <Share2 className={className} />;
    case "instagram":
      return <Hash className={className} />;
    case "linkedin":
      return <Link2 className={className} />;
    case "tiktok":
    case "youtube":
      return <Play className={className} />;
    default:
      return <Globe className={className} />;
  }
}

type BrandUrlEntry = { url: string; type: BrandUrlType };

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", url: "", description: "", market: "global" });
  const [brandUrls, setBrandUrls] = useState<BrandUrlEntry[]>([]);

  function addBrandUrl() {
    setBrandUrls([...brandUrls, { url: "", type: "facebook" }]);
  }

  function removeBrandUrl(index: number) {
    setBrandUrls(brandUrls.filter((_, i) => i !== index));
  }

  function updateBrandUrl(index: number, field: keyof BrandUrlEntry, value: string) {
    setBrandUrls(brandUrls.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    ));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Filter out empty brand URLs
    const validBrandUrls = brandUrls.filter((b) => b.url.trim());

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        url: form.url,
        description: form.description,
        brandUrls: validBrandUrls,
        settings:
          form.market === "il"
            ? { locale: "he", market: "IL", language: "Hebrew", timezone: "Asia/Jerusalem" }
            : {},
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to create project");
      return;
    }

    router.push(`/dashboard/${data.project.id}/intelligence?onboarding=true`);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard">
          <ArrowLeft className="me-2 h-4 w-4" />
          Back to projects
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Create a new project</h1>
        <p className="text-muted-foreground text-sm">
          MarketPilot will research your brand and generate a full marketing intelligence brief.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">Project name</Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              className="h-11"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url" className="text-sm font-medium">
              Website URL{" "}
              <span className="text-muted-foreground font-normal">(recommended)</span>
            </Label>
            <div className="relative">
              <Globe className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="url"
                type="url"
                placeholder="https://acme.com"
                className="ps-9 h-11"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used to research your brand, competitors, and market positioning automatically.
            </p>
          </div>

          {/* Social Profiles Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Social Profiles{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-primary"
                onClick={addBrandUrl}
              >
                <Plus className="h-3.5 w-3.5" />
                Add source
              </Button>
            </div>

            {brandUrls.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add your social media pages to enrich the brand analysis. Great if you don&apos;t have a website yet.
              </p>
            ) : (
              <div className="space-y-2">
                {brandUrls.map((entry, index) => {
                  const option = SOCIAL_OPTIONS.find((o) => o.value === entry.type) ?? SOCIAL_OPTIONS[5];
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={entry.type}
                        onValueChange={(val) => val && updateBrandUrl(index, "type", val)}
                      >
                        <SelectTrigger className="w-[130px] h-9 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <SocialIcon type={entry.type} className="h-3.5 w-3.5" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {SOCIAL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="url"
                        placeholder={option.placeholder}
                        className="h-9 flex-1"
                        value={entry.url}
                        onChange={(e) => updateBrandUrl(index, "url", e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeBrandUrl(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="market" className="text-sm font-medium">Target Market</Label>
            <Select
              value={form.market}
              onValueChange={(val) => val && setForm({ ...form, market: val })}
            >
              <SelectTrigger id="market" className="h-11">
                <SelectValue placeholder="Select market" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (English)</SelectItem>
                <SelectItem value="il">Israel (Hebrew)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Focuses research on your target market — competitors, audience, and content strategies.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="What does your product do? Who is it for?"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                Creating project…
              </>
            ) : (
              "Create project"
            )}
          </Button>
        </form>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
        <Zap className="h-3.5 w-3.5 text-primary" />
        Takes about 2 minutes to set up
      </div>
    </div>
  );
}
