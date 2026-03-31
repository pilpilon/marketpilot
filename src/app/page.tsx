import Link from "next/link";
import {
  Zap,
  Brain,
  CalendarDays,
  Share2,
  BarChart3,
  MessageSquareReply,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Brain,
    title: "Brand Intelligence",
    description:
      "Upload brand assets, tone guides, and competitor intel. MarketPilot learns your brand DNA and keeps every post on-message.",
  },
  {
    icon: Zap,
    title: "AI Skills Engine",
    description:
      "Specialized AI agents for copywriting, image generation, and campaign strategy. Each skill trained on marketing best practices.",
  },
  {
    icon: CalendarDays,
    title: "Content Calendar",
    description:
      "Plan, schedule, and publish across every platform from a single drag-and-drop calendar. Never miss a posting window.",
  },
  {
    icon: Share2,
    title: "Multi-Platform Publishing",
    description:
      "Connect Twitter/X, LinkedIn, Instagram, and more. Publish simultaneously with platform-optimized formatting.",
  },
  {
    icon: MessageSquareReply,
    title: "Auto-Reply",
    description:
      "Intelligent comment and DM responses that match your brand voice. Engage your audience 24/7 without lifting a finger.",
  },
  {
    icon: BarChart3,
    title: "Campaign Analytics",
    description:
      "Track reach, engagement, and conversions per campaign. AI-driven insights surface what's working and why.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create your project",
    description:
      "Set up a workspace for your brand. Connect social accounts and upload brand guidelines in minutes.",
  },
  {
    number: "02",
    title: "Train the AI on your brand",
    description:
      "Feed MarketPilot your tone of voice, visual identity, and target audience. The AI learns what makes your brand unique.",
  },
  {
    number: "03",
    title: "Generate & schedule content",
    description:
      "Create campaigns with a single prompt. Review, refine, and schedule posts across all platforms at once.",
  },
];

const stats = [
  { value: "10×", label: "faster content creation" },
  { value: "3.2×", label: "average engagement lift" },
  { value: "40h", label: "saved per month" },
  { value: "99.9%", label: "uptime SLA" },
];

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 glass-nav border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg primary-gradient text-white font-bold text-sm font-heading">
              MP
            </div>
            <span className="font-heading font-bold text-lg tracking-tight">MarketPilot</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              size="sm"
              className="primary-gradient text-white border-0 hover:opacity-90"
              asChild
            >
              <Link href="/signup">Get started free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-40 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-bl from-[#dfe0ff]/30 via-transparent to-transparent" />
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#dfe0ff] text-primary text-xs font-semibold tracking-wide uppercase mb-8">
              <Zap className="h-3 w-3" />
              AI-Powered Marketing Platform
            </div>

            <h1 className="font-heading text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] text-foreground mb-6">
              Market smarter.
              <br />
              <span className="text-primary">Scale faster.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed mb-10">
              MarketPilot uses AI to generate on-brand content, automate scheduling, and grow your
              social presence — across every platform, all at once.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                className="primary-gradient text-white border-0 hover:opacity-90 h-12 px-8 font-heading font-semibold"
                asChild
              >
                <Link href="/signup">
                  Start for free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 font-heading font-semibold" asChild>
                <Link href="/login">View demo</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-6 mt-10">
              {["No credit card required", "Free 14-day trial", "Cancel anytime"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-heading text-4xl font-extrabold text-primary tracking-tight">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 md:py-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Everything you need to dominate social
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              From brand intelligence to auto-replies, MarketPilot handles the full lifecycle of
              social media marketing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card rounded-xl p-8 border border-border card-hover group"
              >
                <div className="w-11 h-11 rounded-lg primary-gradient flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-heading text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 md:py-40 bg-[#f2f4f6]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Up and running in minutes
            </h2>
            <p className="text-lg text-muted-foreground">
              Three steps from zero to a fully automated marketing engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16">
            {steps.map((step) => (
              <div key={step.number} className="relative">
                <div className="font-heading text-8xl font-extrabold text-primary/10 tracking-tighter mb-4 leading-none">
                  {step.number}
                </div>
                <h3 className="font-heading text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-40">
        <div className="max-w-5xl mx-auto px-6">
          <div className="primary-gradient rounded-2xl p-12 md:p-20 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

            <div className="relative z-10 space-y-6">
              <h2 className="font-heading text-4xl md:text-6xl font-extrabold tracking-tight">
                Ready to pilot your growth?
              </h2>
              <p className="text-xl opacity-90 max-w-xl mx-auto leading-relaxed">
                Join thousands of marketers who use MarketPilot to save time and drive results.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 px-10 h-13 font-heading font-bold text-lg"
                  asChild
                >
                  <Link href="/signup">Get started for free</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 px-10 h-13 font-heading font-bold text-lg"
                  asChild
                >
                  <Link href="/login">Talk to sales</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md primary-gradient text-white font-bold text-xs font-heading">
              MP
            </div>
            <span className="font-heading font-bold tracking-tight">MarketPilot</span>
          </div>
          <div className="flex gap-8 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <a href="#" className="hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Contact
            </a>
          </div>
          <div className="text-xs text-muted-foreground">© 2025 MarketPilot. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
