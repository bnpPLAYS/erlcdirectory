export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      connection_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          participant_one: string
          participant_two: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one: string
          participant_two: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one?: string
          participant_two?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_one_fkey"
            columns: ["participant_one"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_two_fkey"
            columns: ["participant_two"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_verification_requests: {
        Row: {
          approver_discord_id: string | null
          approver_discord_username: string | null
          approver_review_rating: number | null
          approver_review_text: string | null
          approver_stated_position: string | null
          created_at: string
          decided_at: string | null
          experience_id: string
          expires_at: string
          guild_icon: string | null
          guild_id: string
          guild_name: string | null
          id: string
          profile_id: string
          status: string
          token: string
        }
        Insert: {
          approver_discord_id?: string | null
          approver_discord_username?: string | null
          approver_review_rating?: number | null
          approver_review_text?: string | null
          approver_stated_position?: string | null
          created_at?: string
          decided_at?: string | null
          experience_id: string
          expires_at: string
          guild_icon?: string | null
          guild_id: string
          guild_name?: string | null
          id?: string
          profile_id: string
          status?: string
          token: string
        }
        Update: {
          approver_discord_id?: string | null
          approver_discord_username?: string | null
          approver_review_rating?: number | null
          approver_review_text?: string | null
          approver_stated_position?: string | null
          created_at?: string
          decided_at?: string | null
          experience_id?: string
          expires_at?: string
          guild_icon?: string | null
          guild_id?: string
          guild_name?: string | null
          id?: string
          profile_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_verification_requests_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          end_date: string | null
          guild_id: string | null
          id: string
          is_current: boolean | null
          is_verified: boolean | null
          profile_id: string
          role: string
          server_icon: string | null
          server_name: string
          show_on_directory_card: boolean
          start_date: string
          verified_at: string | null
          verified_by_discord_id: string | null
          verified_by_discord_username: string | null
          verifier_review_rating: number | null
          verifier_review_text: string | null
          verifier_stated_position: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          end_date?: string | null
          guild_id?: string | null
          id?: string
          is_current?: boolean | null
          is_verified?: boolean | null
          profile_id: string
          role: string
          server_icon?: string | null
          server_name: string
          show_on_directory_card?: boolean
          start_date?: string
          verified_at?: string | null
          verified_by_discord_id?: string | null
          verified_by_discord_username?: string | null
          verifier_review_rating?: number | null
          verifier_review_text?: string | null
          verifier_stated_position?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          end_date?: string | null
          guild_id?: string | null
          id?: string
          is_current?: boolean | null
          is_verified?: boolean | null
          profile_id?: string
          role?: string
          server_icon?: string | null
          server_name?: string
          show_on_directory_card?: boolean
          start_date?: string
          verified_at?: string | null
          verified_by_discord_id?: string | null
          verified_by_discord_username?: string | null
          verifier_review_rating?: number | null
          verifier_review_text?: string | null
          verifier_stated_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experiences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          message_id: string | null
          reason: string
          report_category: string | null
          reporter_profile_id: string
          resolved_at: string | null
          review_id: string | null
          server_id: string | null
          staff_notes: string | null
          status: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message_id?: string | null
          reason: string
          report_category?: string | null
          reporter_profile_id: string
          resolved_at?: string | null
          review_id?: string | null
          server_id?: string | null
          staff_notes?: string | null
          status?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message_id?: string | null
          reason?: string
          report_category?: string | null
          reporter_profile_id?: string
          resolved_at?: string | null
          review_id?: string | null
          server_id?: string | null
          staff_notes?: string | null
          status?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          application_count: number | null
          application_url: string | null
          author_id: string
          content: string
          created_at: string
          id: string
          is_open: boolean | null
          requirements: string[] | null
          require_guild_membership: boolean
          server_id: string | null
          status: string
          title: string
          type: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          application_count?: number | null
          application_url?: string | null
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_open?: boolean | null
          requirements?: string[] | null
          require_guild_membership?: boolean
          server_id?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          application_count?: number | null
          application_url?: string | null
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_open?: boolean | null
          requirements?: string[] | null
          require_guild_membership?: boolean
          server_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_warnings: {
        Row: {
          body: string
          created_at: string
          id: string
          issued_by_profile_id: string
          subject_profile_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          issued_by_profile_id: string
          subject_profile_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          issued_by_profile_id?: string
          subject_profile_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accent_color: string | null
          availability: string | null
          banned_at: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          discord_access_token: string | null
          discord_avatar: string | null
          discord_id: string | null
          discord_refresh_token: string | null
          discord_token_expires_at: string | null
          discord_username: string | null
          dm_experience_status_updates: boolean
          dm_website_updates: boolean
          display_name: string | null
          id: string
          is_featured: boolean | null
          is_pro: boolean
          is_verified: boolean | null
          location: string | null
          pronouns: string | null
          pro_badge_label: string | null
          pro_verified_at: string | null
          rating: number | null
          review_count: number | null
          roblox_user_id: string | null
          skills: string[] | null
          social_links: Json | null
          status: string | null
          theme_preset: string | null
          terms_accepted_at: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          accent_color?: string | null
          availability?: string | null
          banned_at?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          discord_access_token?: string | null
          discord_avatar?: string | null
          discord_id?: string | null
          discord_refresh_token?: string | null
          discord_token_expires_at?: string | null
          discord_username?: string | null
          dm_experience_status_updates?: boolean | null
          dm_website_updates?: boolean | null
          display_name?: string | null
          id?: string
          is_featured?: boolean | null
          is_pro?: boolean
          is_verified?: boolean | null
          location?: string | null
          pronouns?: string | null
          pro_badge_label?: string | null
          pro_verified_at?: string | null
          rating?: number | null
          review_count?: number | null
          roblox_user_id?: string | null
          skills?: string[] | null
          social_links?: Json | null
          status?: string | null
          theme_preset?: string | null
          terms_accepted_at?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          accent_color?: string | null
          availability?: string | null
          banned_at?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          discord_access_token?: string | null
          discord_avatar?: string | null
          discord_id?: string | null
          discord_refresh_token?: string | null
          discord_token_expires_at?: string | null
          discord_username?: string | null
          dm_experience_status_updates?: boolean | null
          dm_website_updates?: boolean | null
          display_name?: string | null
          id?: string
          is_featured?: boolean | null
          is_pro?: boolean
          is_verified?: boolean | null
          location?: string | null
          pronouns?: string | null
          pro_badge_label?: string | null
          pro_verified_at?: string | null
          rating?: number | null
          review_count?: number | null
          roblox_user_id?: string | null
          skills?: string[] | null
          social_links?: Json | null
          status?: string | null
          theme_preset?: string | null
          terms_accepted_at?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          content: string | null
          created_at: string
          id: string
          rating: number
          reviewee_id: string | null
          reviewer_id: string
          server_id: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_id?: string | null
          reviewer_id: string
          server_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string | null
          reviewer_id?: string
          server_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      servers: {
        Row: {
          banner: string | null
          created_at: string
          description: string | null
          discord_invite: string | null
          guild_id: string | null
          icon: string | null
          id: string
          is_featured: boolean | null
          is_hiring: boolean | null
          is_verified: boolean | null
          member_count: number | null
          name: string
          owner_id: string | null
          roblox_link: string | null
          staff_count: number | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          banner?: string | null
          created_at?: string
          description?: string | null
          discord_invite?: string | null
          guild_id?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          is_hiring?: boolean | null
          is_verified?: boolean | null
          member_count?: number | null
          name: string
          owner_id?: string | null
          roblox_link?: string | null
          staff_count?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          banner?: string | null
          created_at?: string
          description?: string | null
          discord_invite?: string | null
          guild_id?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          is_hiring?: boolean | null
          is_verified?: boolean | null
          member_count?: number | null
          name?: string
          owner_id?: string | null
          roblox_link?: string | null
          staff_count?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_profile_by_username_lookup: {
        Args: { lookup: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"][]
      }
      are_connected: { Args: { _a: string; _b: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_my_profile: { Args: { _profile_id: string }; Returns: boolean }
      site_owner_set_profile_flags: {
        Args: {
          p_profile_id: string
          p_is_verified: boolean
          p_is_featured: boolean
        }
        Returns: undefined
      }
      site_owner_grant_admin_role: { Args: { p_target_user_id: string }; Returns: undefined }
      site_owner_revoke_admin_role: { Args: { p_target_user_id: string }; Returns: undefined }
      staff_counts_for_discord_guilds: {
        Args: { p_guild_ids: string[] }
        Returns: { guild_id: string; cnt: number }[]
      }
      site_owner_set_server_verified: {
        Args: { p_server_id: string; p_is_verified: boolean }
        Returns: undefined
      }
      site_owner_set_post_status: {
        Args: { p_post_id: string; p_status: string }
        Returns: undefined
      }
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
