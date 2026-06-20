export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Platform = "twitter" | "instagram" | "tiktok" | "facebook" | "linkedin";
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
export type PostPlatformStatus = "pending" | "processing" | "publishing" | "published" | "failed";
export type SocialAccountStatus = "active" | "expired" | "revoked" | "error";
export type RuleType = "keyword_match" | "ai_generated";
export type AiTone = "professional" | "friendly" | "casual" | "formal";
export type ReplyStatus = "pending_approval" | "approved" | "sent" | "rejected" | "failed";
export type Plan = "free" | "starter" | "pro";

export type BrandUrlType = "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube" | "other";

export interface BrandUrl {
  url: string;
  type: BrandUrlType;
  label?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          plan: Plan;
          paddle_customer_id: string | null;
          paddle_subscription_id: string | null;
          usage_credits_remaining: number;
          locale: "en" | "he";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: Plan;
          paddle_customer_id?: string | null;
          paddle_subscription_id?: string | null;
          usage_credits_remaining?: number;
          locale?: "en" | "he";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          description: string | null;
          url: string | null;
          brand_urls: BrandUrl[];
          repo_url: string | null;
          logo_url: string | null;
          status: "setup" | "active" | "archived";
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          slug: string;
          description?: string | null;
          url?: string | null;
          brand_urls?: BrandUrl[];
          repo_url?: string | null;
          logo_url?: string | null;
          status?: "setup" | "active" | "archived";
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      context_files: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          file_type: string;
          content: string;
          version: number;
          source: "auto" | "manual" | "refined";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          file_type: string;
          content?: string;
          version?: number;
          source?: "auto" | "manual" | "refined";
        };
        Update: Partial<Database["public"]["Tables"]["context_files"]["Insert"]>;
      };
      campaigns: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          name: string;
          campaign_type: string;
          platforms: string[];
          status: "draft" | "active" | "completed" | "archived";
          goal: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          name: string;
          campaign_type: string;
          platforms?: string[];
          status?: "draft" | "active" | "completed" | "archived";
          goal?: string | null;
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
      };
      campaign_assets: {
        Row: {
          id: string;
          campaign_id: string;
          user_id: string;
          asset_type: string;
          title: string | null;
          content: string | null;
          storage_path: string | null;
          metadata: Json;
          status: "draft" | "approved" | "published" | "archived";
          carousel_group_id: string | null;
          slide_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          user_id: string;
          asset_type: string;
          title?: string | null;
          content?: string | null;
          storage_path?: string | null;
          metadata?: Json;
          status?: "draft" | "approved" | "published" | "archived";
          carousel_group_id?: string | null;
          slide_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_assets"]["Insert"]>;
      };
      social_accounts: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          platform: Platform;
          platform_user_id: string;
          platform_username: string | null;
          platform_display_name: string | null;
          platform_avatar_url: string | null;
          access_token_secret_id: string | null;
          refresh_token_secret_id: string | null;
          token_expires_at: string | null;
          scopes: string[];
          status: SocialAccountStatus;
          last_token_refresh_at: string | null;
          connected_at: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          platform: Platform;
          platform_user_id: string;
          platform_username?: string | null;
          platform_display_name?: string | null;
          platform_avatar_url?: string | null;
          access_token_secret_id?: string | null;
          refresh_token_secret_id?: string | null;
          token_expires_at?: string | null;
          scopes?: string[];
          status?: SocialAccountStatus;
          last_token_refresh_at?: string | null;
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["social_accounts"]["Insert"]>;
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          campaign_id: string | null;
          campaign_asset_id: string | null;
          status: PostStatus;
          scheduled_at: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          campaign_id?: string | null;
          campaign_asset_id?: string | null;
          status?: PostStatus;
          scheduled_at?: string | null;
          published_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
      };
      post_platforms: {
        Row: {
          id: string;
          post_id: string;
          social_account_id: string;
          platform: Platform;
          caption: string | null;
          hashtags: string[];
          media_urls: string[];
          platform_post_id: string | null;
          platform_post_url: string | null;
          platform_creation_id: string | null;
          status: PostPlatformStatus;
          error_message: string | null;
          published_at: string | null;
          engagement_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          social_account_id: string;
          platform: Platform;
          caption?: string | null;
          hashtags?: string[];
          media_urls?: string[];
          status?: PostPlatformStatus;
        };
        Update: Partial<Database["public"]["Tables"]["post_platforms"]["Insert"]>;
      };
      post_media: {
        Row: {
          id: string;
          post_id: string;
          storage_path: string;
          imagekit_file_id: string | null;
          original_filename: string | null;
          media_type: "image" | "video" | "gif";
          mime_type: string | null;
          transforms: Json;
          width: number | null;
          height: number | null;
          file_size_bytes: number | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          storage_path: string;
          imagekit_file_id?: string | null;
          original_filename?: string | null;
          media_type: "image" | "video" | "gif";
          mime_type?: string | null;
          transforms?: Json;
          width?: number | null;
          height?: number | null;
          file_size_bytes?: number | null;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["post_media"]["Insert"]>;
      };
      auto_reply_rules: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          social_account_id: string;
          name: string;
          is_active: boolean;
          rule_type: RuleType;
          trigger_keywords: string[];
          reply_template: string | null;
          ai_prompt: string | null;
          ai_tone: AiTone;
          require_approval: boolean;
          max_replies_per_hour: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          social_account_id: string;
          name: string;
          is_active?: boolean;
          rule_type: RuleType;
          trigger_keywords?: string[];
          reply_template?: string | null;
          ai_prompt?: string | null;
          ai_tone?: AiTone;
          require_approval?: boolean;
          max_replies_per_hour?: number;
        };
        Update: Partial<Database["public"]["Tables"]["auto_reply_rules"]["Insert"]>;
      };
      auto_reply_log: {
        Row: {
          id: string;
          rule_id: string;
          social_account_id: string;
          platform: Platform;
          original_comment_id: string;
          original_comment_text: string | null;
          original_author: string | null;
          original_post_platform_id: string | null;
          generated_reply: string;
          status: ReplyStatus;
          error_message: string | null;
          approved_at: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rule_id: string;
          social_account_id: string;
          platform: Platform;
          original_comment_id: string;
          original_comment_text?: string | null;
          original_author?: string | null;
          original_post_platform_id?: string | null;
          generated_reply: string;
          status?: ReplyStatus;
        };
        Update: Partial<Database["public"]["Tables"]["auto_reply_log"]["Insert"]>;
      };
      oauth_states: {
        Row: {
          id: string;
          user_id: string;
          platform: Platform;
          state_token: string;
          code_verifier: string | null;
          redirect_url: string | null;
          project_id: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          platform: Platform;
          state_token: string;
          code_verifier?: string | null;
          redirect_url?: string | null;
          project_id: string;
          expires_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["oauth_states"]["Insert"]>;
      };
      analysis_runs: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          run_type: string;
          provider: string;
          tokens_used: number;
          credits_consumed: number;
          status: "running" | "completed" | "failed";
          error_message: string | null;
          metadata: Json;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          run_type: string;
          provider: string;
          tokens_used?: number;
          credits_consumed?: number;
          status?: "running" | "completed" | "failed";
          error_message?: string | null;
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["analysis_runs"]["Insert"]>;
      };
      templates: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          template_type: string;
          content: string;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          template_type: string;
          content: string;
          is_system?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>;
      };
      content_templates: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          description: string | null;
          category: string;
          format: "single" | "carousel" | "story";
          thumbnail_url: string | null;
          platforms: string[];
          slides: Json;
          default_overlay_style: string;
          brand_tokens: Json;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          description?: string | null;
          category: string;
          format?: "single" | "carousel" | "story";
          thumbnail_url?: string | null;
          platforms?: string[];
          slides?: Json;
          default_overlay_style?: string;
          brand_tokens?: Json;
          is_system?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["content_templates"]["Insert"]>;
      };
      context_attachments: {
        Row: {
          id: string;
          context_file_id: string | null;
          project_id: string;
          user_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string;
          public_url: string;
          extracted_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          context_file_id?: string | null;
          project_id: string;
          user_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string;
          public_url: string;
          extracted_text?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["context_attachments"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
