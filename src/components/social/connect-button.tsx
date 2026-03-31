"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "./platform-icon";
import { Plus } from "lucide-react";
import type { Platform } from "@/types/database";

interface ConnectButtonProps {
  platform: { id: Platform; name: string; description: string };
  projectId: string;
}

export function ConnectButton({ platform, projectId }: ConnectButtonProps) {
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
        <Button variant="outline" className="w-full" asChild>
          <a href={`/api/social/connect/${platform.id}?projectId=${projectId}`}>
            <Plus className="mr-2 h-4 w-4" />
            Connect {platform.name}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
