import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/social/platform-icon";
import { Plus, MessageSquareReply, Inbox } from "lucide-react";
import type { Platform, Database } from "@/types/database";

export default async function AutoReplyPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  type Rule = Database["public"]["Tables"]["auto_reply_rules"]["Row"];
  type Account = Database["public"]["Tables"]["social_accounts"]["Row"];

  const { data } = await supabase
    .from("auto_reply_rules")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rules = (data || []) as Rule[];

  // Fetch associated social accounts
  const accountIds = [...new Set(rules.map((r) => r.social_account_id))];
  let socialAccounts: Account[] = [];
  if (accountIds.length > 0) {
    const { data: accts } = await supabase
      .from("social_accounts")
      .select("*")
      .in("id", accountIds);
    socialAccounts = (accts || []) as Account[];
  }

  const accountMap = new Map(
    socialAccounts.map((a) => [a.id, a])
  );

  // Get pending approval count
  const ruleIds = rules.map((r) => r.id);
  let pendingCount = 0;
  if (ruleIds.length > 0) {
    const { count } = await supabase
      .from("auto_reply_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval")
      .in("rule_id", ruleIds);
    pendingCount = count || 0;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">Auto Replies</h1>
          <p className="text-muted-foreground mt-1">
            Automatically respond to comments on your posts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/${projectId}/auto-reply/queue`}>
              <Inbox className="mr-2 h-4 w-4" />
              Approval Queue
              {(pendingCount || 0) > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingCount}
                </Badge>
              )}
            </Link>
          </Button>
          <Button className="primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold" asChild>
            <Link href={`/dashboard/${projectId}/auto-reply/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Rule
            </Link>
          </Button>
        </div>
      </div>

      {rules && rules.length > 0 ? (
        <div className="grid gap-4">
          {rules.map((rule) => {
            const account = accountMap.get(rule.social_account_id);
            if (!account) return null;
            return (
              <Card key={rule.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <PlatformIcon
                      platform={account.platform}
                      className="h-5 w-5"
                    />
                    <CardTitle className="text-base">{rule.name}</CardTitle>
                    <Badge variant="outline">
                      {rule.rule_type === "keyword_match"
                        ? "Keyword Match"
                        : "AI Generated"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={rule.is_active ? "default" : "secondary"}>
                      {rule.is_active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Account: @{account.platform_username}</p>
                    {rule.rule_type === "keyword_match" && (
                      <p>
                        Keywords:{" "}
                        {(rule.trigger_keywords || []).map((kw) => (
                          <Badge key={kw} variant="secondary" className="mr-1 text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </p>
                    )}
                    <p>
                      Approval required:{" "}
                      {rule.require_approval ? "Yes" : "No (auto-send)"}
                    </p>
                    <p>Rate limit: {rule.max_replies_per_hour}/hour</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center py-16">
          <MessageSquareReply className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No auto-reply rules</h2>
          <p className="text-muted-foreground mb-4">
            Create rules to automatically respond to comments
          </p>
          <Button asChild>
            <Link href={`/dashboard/${projectId}/auto-reply/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Rule
            </Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
