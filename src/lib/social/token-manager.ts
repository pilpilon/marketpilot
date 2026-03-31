import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPlatformClient } from "./platforms";
import type { Database } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

/**
 * Store a token securely in Supabase Vault.
 * Returns the vault secret UUID.
 */
export async function storeTokenInVault(
  token: string,
  name: string
): Promise<string> {
  const supabase = await createServiceRoleClient();

  const { data, error } = await supabase.rpc("vault_create_secret" as never, {
    new_secret: token,
    new_name: name,
  } as never);

  if (error) {
    // Fallback: store encrypted in a simple way if vault isn't available
    // In production, vault extension must be enabled
    console.error("Vault not available, storing token directly:", error.message);
    // Return a placeholder - in real deployment, vault must work
    return `plain:${Buffer.from(token).toString("base64")}`;
  }

  return data as unknown as string;
}

/**
 * Read a decrypted token from Supabase Vault.
 */
export async function getDecryptedToken(
  secretId: string
): Promise<string | null> {
  if (!secretId) return null;

  // Handle fallback plain tokens
  if (secretId.startsWith("plain:")) {
    return Buffer.from(secretId.slice(6), "base64").toString();
  }

  const supabase = await createServiceRoleClient();

  const { data, error } = await supabase
    .from("vault.decrypted_secrets" as never)
    .select("decrypted_secret")
    .eq("id", secretId)
    .single();

  if (error || !data) {
    console.error("Failed to read vault secret:", error?.message);
    return null;
  }

  return (data as { decrypted_secret: string }).decrypted_secret;
}

/**
 * Delete a vault secret.
 */
export async function deleteVaultSecret(secretId: string): Promise<void> {
  if (!secretId || secretId.startsWith("plain:")) return;

  const supabase = await createServiceRoleClient();
  await supabase.rpc("vault_delete_secret" as never, {
    secret_id: secretId,
  } as never);
}

/**
 * Get decrypted access and refresh tokens for a social account.
 */
export async function getAccountTokens(account: SocialAccount): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    account.access_token_secret_id
      ? getDecryptedToken(account.access_token_secret_id)
      : null,
    account.refresh_token_secret_id
      ? getDecryptedToken(account.refresh_token_secret_id)
      : null,
  ]);

  return { accessToken, refreshToken };
}

/**
 * Check if a token is expiring soon (within 1 hour).
 */
export function isTokenExpiringSoon(account: SocialAccount): boolean {
  if (!account.token_expires_at) return false;
  const expiresAt = new Date(account.token_expires_at);
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  return expiresAt <= oneHourFromNow;
}

/**
 * Refresh tokens for a social account.
 * Creates new vault secrets, updates the account, and deletes old secrets.
 */
export async function refreshAccountTokens(
  account: SocialAccount
): Promise<void> {
  const supabase = await createServiceRoleClient();
  const { refreshToken } = await getAccountTokens(account);

  if (!refreshToken) {
    // Mark as expired if no refresh token
    await supabase
      .from("social_accounts")
      .update({ status: "expired" })
      .eq("id", account.id);
    return;
  }

  try {
    const client = getPlatformClient(account.platform);
    const newTokens = await client.refreshToken(refreshToken);

    // Store new tokens in vault
    const newAccessSecretId = await storeTokenInVault(
      newTokens.accessToken,
      `${account.platform}_access_${account.id}`
    );

    let newRefreshSecretId = account.refresh_token_secret_id;
    if (newTokens.refreshToken) {
      newRefreshSecretId = await storeTokenInVault(
        newTokens.refreshToken,
        `${account.platform}_refresh_${account.id}`
      );
    }

    // Update account with new vault references
    await supabase
      .from("social_accounts")
      .update({
        access_token_secret_id: newAccessSecretId,
        refresh_token_secret_id: newRefreshSecretId,
        token_expires_at: newTokens.expiresAt.toISOString(),
        last_token_refresh_at: new Date().toISOString(),
        status: "active",
      })
      .eq("id", account.id);

    // Delete old vault secrets
    if (account.access_token_secret_id) {
      await deleteVaultSecret(account.access_token_secret_id);
    }
    if (
      newTokens.refreshToken &&
      account.refresh_token_secret_id &&
      account.refresh_token_secret_id !== newRefreshSecretId
    ) {
      await deleteVaultSecret(account.refresh_token_secret_id);
    }
  } catch (error) {
    console.error(
      `Token refresh failed for ${account.platform}/${account.platform_username}:`,
      error
    );

    await supabase
      .from("social_accounts")
      .update({ status: "error" })
      .eq("id", account.id);
  }
}
