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
import { useTranslations } from "next-intl";

const featureIcons = [Brain, Zap, CalendarDays, Share2, MessageSquareReply, BarChart3];
const stepNumbers = ["01", "02", "03"];

export default function LandingPage() {
  const t = useTranslations("landing");

  const features = [
    { icon: featureIcons[0], title: t("features.feat1Title"), description: t("features.feat1Desc") },
    { icon: featureIcons[1], title: t("features.feat2Title"), description: t("features.feat2Desc") },
    { icon: featureIcons[2], title: t("features.feat3Title"), description: t("features.feat3Desc") },
    { icon: featureIcons[3], title: t("features.feat4Title"), description: t("features.feat4Desc") },
    { icon: featureIcons[4], title: t("features.feat5Title"), description: t("features.feat5Desc") },
    { icon: featureIcons[5], title: t("features.feat6Title"), description: t("features.feat6Desc") },
  ];

  const steps = [
    { number: stepNumbers[0], title: t("steps.step1Title"), description: t("steps.step1Desc") },
    { number: stepNumbers[1], title: t("steps.step2Title"), description: t("steps.step2Desc") },
    { number: stepNumbers[2], title: t("steps.step3Title"), description: t("steps.step3Desc") },
  ];

  const stats = [
    { value: t("stats.stat1Value"), label: t("stats.stat1Label") },
    { value: t("stats.stat2Value"), label: t("stats.stat2Label") },
    { value: t("stats.stat3Value"), label: t("stats.stat3Label") },
    { value: t("stats.stat4Value"), label: t("stats.stat4Label") },
  ];

  const heroBullets = [t("hero.noCreditCard"), t("hero.freeTrial"), t("hero.cancelAnytime")];

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
              {t("nav.features")}
            </a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("nav.howItWorks")}
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">{t("nav.signIn")}</Link>
            </Button>
            <Button
              size="sm"
              className="primary-gradient text-white border-0 hover:opacity-90"
              asChild
            >
              <Link href="/signup">{t("nav.getStartedFree")}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-40 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 end-0 w-2/3 h-full bg-gradient-to-bl from-[#dfe0ff]/30 via-transparent to-transparent" />
          <div className="absolute -top-40 -end-40 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#dfe0ff] text-primary text-xs font-semibold tracking-wide uppercase mb-8">
              <Zap className="h-3 w-3" />
              {t("hero.badge")}
            </div>

            <h1 className="font-heading text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] text-foreground mb-6">
              {t("hero.titleLine1")}
              <br />
              <span className="text-primary">{t("hero.titleLine2")}</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed mb-10">
              {t("hero.subtitle")}
            </p>

            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                className="primary-gradient text-white border-0 hover:opacity-90 h-12 px-8 font-heading font-semibold"
                asChild
              >
                <Link href="/signup">
                  {t("hero.startForFree")}
                  <ArrowRight className="ms-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 font-heading font-semibold" asChild>
                <Link href="/login">{t("hero.viewDemo")}</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-6 mt-10">
              {heroBullets.map((item) => (
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
              {t("features.title")}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("features.subtitle")}
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
              {t("steps.title")}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t("steps.subtitle")}
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
            <div className="absolute top-0 end-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 start-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

            <div className="relative z-10 space-y-6">
              <h2 className="font-heading text-4xl md:text-6xl font-extrabold tracking-tight">
                {t("cta.title")}
              </h2>
              <p className="text-xl opacity-90 max-w-xl mx-auto leading-relaxed">
                {t("cta.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 px-10 h-13 font-heading font-bold text-lg"
                  asChild
                >
                  <Link href="/signup">{t("cta.getStartedFree")}</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 px-10 h-13 font-heading font-bold text-lg"
                  asChild
                >
                  <Link href="/login">{t("cta.talkToSales")}</Link>
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
              {t("footer.privacyPolicy")}
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              {t("footer.termsOfService")}
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              {t("footer.contact")}
            </a>
          </div>
          <div className="text-xs text-muted-foreground">{t("footer.copyright")}</div>
        </div>
      </footer>
    </div>
  );
}
