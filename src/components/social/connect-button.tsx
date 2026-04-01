"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "./platform-icon";
import { Plus, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Platform } from "@/types/database";

interface ConnectButtonProps {
  platform: { id: Platform; name: string; description: string };
  projectId: string;
}

export function ConnectButton({ platform, projectId }: ConnectButtonProps) {
  const t = useTranslations("social");

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <PlatformIcon platform={platform.id} className="h-6 w-6 opacity-50" />
        <CardTitle className="text-lg text-muted-foreground">
          {platform.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{platform.description}</p>
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full" asChild>
            <a href={`/api/social/connect/${platform.id}?projectId=${projectId}`}>
              <Plus className="me-2 h-4 w-4" />
              Connect {platform.name}
            </a>
          </Button>
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" asChild>
            <Link href={`/dashboard/${projectId}/social/help?platform=${platform.id}`}>
              <HelpCircle className="me-1.5 h-3.5 w-3.5" />
              {t("howToConnect")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
