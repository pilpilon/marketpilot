"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, CheckCircle2, Unplug } from "lucide-react";
import { PlatformIcon } from "./platform-icon";
import type { Database, Platform } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

interface SocialAccountCardProps {
  account: SocialAccount;
  platformInfo: { id: Platform; name: string; description: string };
  projectId?: string;
}

export function SocialAccountCard({
  account,
  platformInfo,
  projectId,
}: SocialAccountCardProps) {
  const isHealthy = account.status === "active";
  const reconnectHref = projectId
    ? `/api/social/connect/${account.platform}?projectId=${projectId}`
    : `/api/social/connect/${account.platform}`;

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${platformInfo.name}?`)) return;

    await fetch("/api/social/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        socialAccountId: account.id,
      }),
    });

    window.location.reload();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <PlatformIcon platform={account.platform} className="h-6 w-6" />
          <CardTitle className="text-lg">{platformInfo.name}</CardTitle>
        </div>
        <Badge variant={isHealthy ? "default" : "destructive"}>
          {isHealthy ? (
            <><CheckCircle2 className="me-1 h-3 w-3" /> Connected</>
          ) : (
            <><AlertCircle className="me-1 h-3 w-3" /> {account.status}</>
          )}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={account.platform_avatar_url || undefined} />
            <AvatarFallback>
              {(account.platform_username || "?")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">
              {account.platform_display_name || account.platform_username}
            </p>
            <p className="text-sm text-muted-foreground">
              @{account.platform_username}
            </p>
          </div>
        </div>

        {account.status === "expired" && (
          <Button
            variant="outline"
            className="w-full"
            asChild
          >
            <a href={reconnectHref}>
              Reconnect
            </a>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive"
          onClick={handleDisconnect}
        >
          <Unplug className="me-2 h-4 w-4" />
          Disconnect
        </Button>
      </CardContent>
    </Card>
  );
}
