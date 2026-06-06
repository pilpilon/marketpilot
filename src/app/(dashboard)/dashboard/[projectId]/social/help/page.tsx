"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/social/platform-icon";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { Platform } from "@/types/database";

const VALID_PLATFORMS: Platform[] = ["instagram", "facebook", "twitter", "tiktok"];

export default function SocialHelpPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const platform = searchParams.get("platform") as Platform | null;
  const t = useTranslations("socialHelp");

  const activePlatform =
    platform && VALID_PLATFORMS.includes(platform) ? platform : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${projectId}/social`}>
            <ArrowLeft className="me-1 h-4 w-4" />
            {t("backToAccounts")}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Info className="h-6 w-6 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-2 flex-wrap">
        {VALID_PLATFORMS.map((p) => (
          <Link
            key={p}
            href={`/dashboard/${projectId}/social/help?platform=${p}`}
            scroll={false}
          >
            <Badge
              variant={activePlatform === p ? "default" : "outline"}
              className="cursor-pointer px-3 py-1.5 text-sm gap-1.5"
            >
              <PlatformIcon platform={p} className="h-3.5 w-3.5" />
              {t(`${p}Name`)}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Show all or specific platform */}
      {!activePlatform ? (
        <div className="space-y-6">
          <InstagramGuide t={t} projectId={projectId} />
          <FacebookGuide t={t} projectId={projectId} />
          <TwitterGuide t={t} projectId={projectId} />
          <TikTokGuide t={t} projectId={projectId} />
        </div>
      ) : (
        <>
          {activePlatform === "instagram" && <InstagramGuide t={t} projectId={projectId} />}
          {activePlatform === "facebook" && <FacebookGuide t={t} projectId={projectId} />}
          {activePlatform === "twitter" && <TwitterGuide t={t} projectId={projectId} />}
          {activePlatform === "tiktok" && <TikTokGuide t={t} projectId={projectId} />}
        </>
      )}
    </div>
  );
}

interface GuideProps {
  t: ReturnType<typeof useTranslations<"socialHelp">>;
  projectId: string;
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3 list-none">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
            {i + 1}
          </span>
          <span className="text-sm leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Prerequisite({ items }: { items: string[] }) {
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
        <AlertTriangle className="h-4 w-4" />
        {items.length > 0 && items[0]}
      </div>
      {items.slice(1).map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-400">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {item}
        </div>
      ))}
    </div>
  );
}

function ConnectNowButton({ platform, projectId, t }: GuideProps & { platform: Platform }) {
  return (
    <Button className="primary-gradient text-white border-0 hover:opacity-90" asChild>
      <a href={`/api/social/connect/${platform}?projectId=${projectId}`}>
        <PlatformIcon platform={platform} className="me-2 h-4 w-4" />
        {t("connectNow")}
      </a>
    </Button>
  );
}

function InstagramGuide({ t, projectId }: GuideProps) {
  const prereqs = [
    t("instagram.prereqTitle"),
    t("instagram.prereq1"),
    t("instagram.prereq2"),
    t("instagram.prereq3"),
  ];

  const steps = [
    t("instagram.step1"),
    t("instagram.step2"),
    t("instagram.step3"),
    t("instagram.step4"),
    t("instagram.step5"),
    t("instagram.step6"),
  ];

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <PlatformIcon platform="instagram" className="h-8 w-8" />
          <div>
            <h2 className="font-heading text-lg font-bold">{t("instagram.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("instagram.desc")}</p>
          </div>
        </div>

        <Prerequisite items={prereqs} />

        <div>
          <h3 className="text-sm font-semibold mb-3">{t("instagram.stepsTitle")}</h3>
          <StepList steps={steps} />
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
            <Info className="h-4 w-4" />
            {t("instagram.switchTitle")}
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-400">{t("instagram.switchDesc")}</p>
        </div>

        <ConnectNowButton platform="instagram" projectId={projectId} t={t} />
      </CardContent>
    </Card>
  );
}

function FacebookGuide({ t, projectId }: GuideProps) {
  const prereqs = [
    t("facebook.prereqTitle"),
    t("facebook.prereq1"),
    t("facebook.prereq2"),
  ];

  const steps = [
    t("facebook.step1"),
    t("facebook.step2"),
    t("facebook.step3"),
    t("facebook.step4"),
  ];

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <PlatformIcon platform="facebook" className="h-8 w-8" />
          <div>
            <h2 className="font-heading text-lg font-bold">{t("facebook.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("facebook.desc")}</p>
          </div>
        </div>

        <Prerequisite items={prereqs} />

        <div>
          <h3 className="text-sm font-semibold mb-3">{t("facebook.stepsTitle")}</h3>
          <StepList steps={steps} />
        </div>

        <ConnectNowButton platform="facebook" projectId={projectId} t={t} />
      </CardContent>
    </Card>
  );
}

function TwitterGuide({ t, projectId }: GuideProps) {
  const steps = [
    t("twitter.step1"),
    t("twitter.step2"),
    t("twitter.step3"),
  ];

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <PlatformIcon platform="twitter" className="h-8 w-8" />
          <div>
            <h2 className="font-heading text-lg font-bold">{t("twitter.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("twitter.desc")}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">{t("twitter.stepsTitle")}</h3>
          <StepList steps={steps} />
        </div>

        <ConnectNowButton platform="twitter" projectId={projectId} t={t} />
      </CardContent>
    </Card>
  );
}

function TikTokGuide({ t, projectId }: GuideProps) {
  const prereqs = [
    t("tiktok.prereqTitle"),
    t("tiktok.prereq1"),
  ];

  const steps = [
    t("tiktok.step1"),
    t("tiktok.step2"),
    t("tiktok.step3"),
    t("tiktok.step4"),
  ];

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <PlatformIcon platform="tiktok" className="h-8 w-8" />
          <div>
            <h2 className="font-heading text-lg font-bold">{t("tiktok.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("tiktok.desc")}</p>
          </div>
        </div>

        <Prerequisite items={prereqs} />

        <div>
          <h3 className="text-sm font-semibold mb-3">{t("tiktok.stepsTitle")}</h3>
          <StepList steps={steps} />
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-400">{t("tiktok.note")}</p>
        </div>

        <ConnectNowButton platform="tiktok" projectId={projectId} t={t} />
      </CardContent>
    </Card>
  );
}
