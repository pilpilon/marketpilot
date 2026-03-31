import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPlatformClient } from "@/lib/social/platforms";
import { getAccountTokens } from "@/lib/social/token-manager";
import type { Database } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];
type AutoReplyRule = Database["public"]["Tables"]["auto_reply_rules"]["Row"];

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Get all active rules
  const { data: rulesData, error } = await supabase
    .from("auto_reply_rules")
    .select("*")
    .eq("is_active", true);

  const rules = (rulesData || []) as AutoReplyRule[];

  if (error || rules.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Fetch associated social accounts
  const accountIds = [...new Set(rules.map((r) => r.social_account_id))];
  const { data: accountsData } = await supabase
    .from("social_accounts")
    .select("*")
    .in("id", accountIds);

  const allAccounts = (accountsData || []) as SocialAccount[];
  const accountsById = new Map(allAccounts.map((a) => [a.id, a]));

  let processed = 0;
  let repliesGenerated = 0;

  // Group rules by social account to avoid duplicate API calls
  const rulesByAccount = new Map<string, AutoReplyRule[]>();
  const accountsMap = new Map<string, SocialAccount>();

  for (const rule of rules) {
    const account = accountsById.get(rule.social_account_id);
    if (!account) continue;
    const accountId = account.id;

    if (!rulesByAccount.has(accountId)) {
      rulesByAccount.set(accountId, []);
      accountsMap.set(accountId, account);
    }
    rulesByAccount.get(accountId)!.push(rule);
  }

  for (const [accountId, accountRules] of rulesByAccount) {
    const account = accountsMap.get(accountId)!;

    if (account.status !== "active") continue;

    try {
      const { accessToken } = await getAccountTokens(account);
      if (!accessToken) continue;

      const client = getPlatformClient(account.platform);

      // Get published posts for this account
      const { data: publishedPosts } = await supabase
        .from("post_platforms")
        .select("platform_post_id")
        .eq("social_account_id", accountId)
        .eq("status", "published")
        .not("platform_post_id", "is", null)
        .order("published_at", { ascending: false })
        .limit(10);

      if (!publishedPosts) continue;

      const typedPosts = publishedPosts as Array<{ platform_post_id: string | null }>;

      for (const pp of typedPosts) {
        if (!pp.platform_post_id) continue;

        // Get cursor from metadata
        const metadata = (account.metadata || {}) as Record<string, string>;
        const cursorKey = `comment_cursor_${pp.platform_post_id}`;
        const sinceId = metadata[cursorKey];

        const comments = await client.getComments(
          accessToken,
          pp.platform_post_id,
          sinceId
        );

        for (const comment of comments) {
          // Check if we already processed this comment
          const { data: existing } = await supabase
            .from("auto_reply_log")
            .select("id")
            .eq("original_comment_id", comment.id)
            .single();

          if (existing) continue;

          // Evaluate rules
          for (const rule of accountRules) {
            let matchedReply: string | null = null;

            if (rule.rule_type === "keyword_match") {
              const keywords = rule.trigger_keywords || [];
              const commentLower = comment.text.toLowerCase();
              const matched = keywords.some((kw) =>
                commentLower.includes(kw.toLowerCase())
              );
              if (matched) {
                matchedReply = rule.reply_template || "";
              }
            } else if (rule.rule_type === "ai_generated") {
              // TODO: Call Gemini AI to generate reply
              // For now, skip AI rules
              continue;
            }

            if (matchedReply) {
              // Check rate limit
              const oneHourAgo = new Date(
                Date.now() - 60 * 60 * 1000
              ).toISOString();
              const { count } = await supabase
                .from("auto_reply_log")
                .select("id", { count: "exact", head: true })
                .eq("rule_id", rule.id)
                .eq("status", "sent")
                .gte("sent_at", oneHourAgo);

              if ((count || 0) >= rule.max_replies_per_hour) continue;

              if (rule.require_approval) {
                await supabase.from("auto_reply_log").insert({
                  rule_id: rule.id,
                  social_account_id: accountId,
                  platform: account.platform,
                  original_comment_id: comment.id,
                  original_comment_text: comment.text,
                  original_author: comment.author,
                  generated_reply: matchedReply,
                  status: "pending_approval",
                });
              } else {
                // Send immediately
                try {
                  await client.replyToComment(
                    accessToken,
                    comment.id,
                    matchedReply
                  );
                  await supabase.from("auto_reply_log").insert({
                    rule_id: rule.id,
                    social_account_id: accountId,
                    platform: account.platform,
                    original_comment_id: comment.id,
                    original_comment_text: comment.text,
                    original_author: comment.author,
                    generated_reply: matchedReply,
                    status: "sent",
                    sent_at: new Date().toISOString(),
                  });
                } catch (replyErr) {
                  await supabase.from("auto_reply_log").insert({
                    rule_id: rule.id,
                    social_account_id: accountId,
                    platform: account.platform,
                    original_comment_id: comment.id,
                    original_comment_text: comment.text,
                    original_author: comment.author,
                    generated_reply: matchedReply,
                    status: "failed",
                    error_message:
                      replyErr instanceof Error
                        ? replyErr.message
                        : "Failed to send reply",
                  });
                }
              }

              repliesGenerated++;
              break; // Only first matching rule per comment
            }
          }
        }

        // Update cursor
        if (comments.length > 0) {
          const lastComment = comments[comments.length - 1];
          await supabase
            .from("social_accounts")
            .update({
              metadata: {
                ...metadata,
                [cursorKey]: lastComment.id,
              },
            })
            .eq("id", accountId);
        }

        processed++;
      }
    } catch (err) {
      console.error(
        `Comment monitoring failed for ${account.platform}/${account.platform_username}:`,
        err
      );
    }
  }

  return NextResponse.json({ processed, repliesGenerated });
}
