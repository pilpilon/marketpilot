"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Globe, Loader2, Zap } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", url: "", description: "", market: "global" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        url: form.url,
        description: form.description,
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
          <ArrowLeft className="mr-2 h-4 w-4" />
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
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="url"
                type="url"
                placeholder="https://acme.com"
                className="pl-9 h-11"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used to research your brand, competitors, and market positioning automatically.
            </p>
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
