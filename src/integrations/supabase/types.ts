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
      activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_analytics: {
        Row: {
          avg_response_time_ms: number | null
          created_at: string
          date: string
          id: string
          peak_hour: number | null
          thumbs_down_count: number
          thumbs_up_count: number
          topics: Json | null
          total_conversations: number
          total_messages: number
          unique_users: number
          updated_at: string
        }
        Insert: {
          avg_response_time_ms?: number | null
          created_at?: string
          date: string
          id?: string
          peak_hour?: number | null
          thumbs_down_count?: number
          thumbs_up_count?: number
          topics?: Json | null
          total_conversations?: number
          total_messages?: number
          unique_users?: number
          updated_at?: string
        }
        Update: {
          avg_response_time_ms?: number | null
          created_at?: string
          date?: string
          id?: string
          peak_hour?: number | null
          thumbs_down_count?: number
          thumbs_up_count?: number
          topics?: Json | null
          total_conversations?: number
          total_messages?: number
          unique_users?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_feedback: {
        Row: {
          chat_log_id: string | null
          created_at: string
          csat_score: number | null
          id: string
          is_abandoned: boolean | null
          rating: string | null
          user_id: string | null
        }
        Insert: {
          chat_log_id?: string | null
          created_at?: string
          csat_score?: number | null
          id?: string
          is_abandoned?: boolean | null
          rating?: string | null
          user_id?: string | null
        }
        Update: {
          chat_log_id?: string | null
          created_at?: string
          csat_score?: number | null
          id?: string
          is_abandoned?: boolean | null
          rating?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_feedback_chat_log_id_fkey"
            columns: ["chat_log_id"]
            isOneToOne: false
            referencedRelation: "chat_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_logs: {
        Row: {
          ai_response: string
          confidence_score: number | null
          created_at: string
          id: string
          is_repeated: boolean | null
          response_time_ms: number | null
          session_id: string | null
          topic: string | null
          user_id: string | null
          user_message: string
        }
        Insert: {
          ai_response: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_repeated?: boolean | null
          response_time_ms?: number | null
          session_id?: string | null
          topic?: string | null
          user_id?: string | null
          user_message: string
        }
        Update: {
          ai_response?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_repeated?: boolean | null
          response_time_ms?: number | null
          session_id?: string | null
          topic?: string | null
          user_id?: string | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json | null
          session_end: string | null
          session_start: string
          total_messages: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          session_end?: string | null
          session_start?: string
          total_messages?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          session_end?: string | null
          session_start?: string
          total_messages?: number
          user_id?: string | null
        }
        Relationships: []
      }
      file_sources: {
        Row: {
          content_extracted: string | null
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          indexing_status: Database["public"]["Enums"]["source_status"]
          source_id: string
          tags: string[] | null
          updated_at: string
          version: number
        }
        Insert: {
          content_extracted?: string | null
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          indexing_status?: Database["public"]["Enums"]["source_status"]
          source_id: string
          tags?: string[] | null
          updated_at?: string
          version?: number
        }
        Update: {
          content_extracted?: string | null
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          indexing_status?: Database["public"]["Enums"]["source_status"]
          source_id?: string
          tags?: string[] | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "file_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sources: {
        Row: {
          auth_credentials: Json | null
          auth_type: string
          created_at: string
          id: string
          integration_type: string
          last_sync_at: string | null
          records_synced: number | null
          selected_fields: Json | null
          selected_objects: string[] | null
          source_id: string
          sync_frequency: Database["public"]["Enums"]["sync_frequency"]
          updated_at: string
        }
        Insert: {
          auth_credentials?: Json | null
          auth_type: string
          created_at?: string
          id?: string
          integration_type: string
          last_sync_at?: string | null
          records_synced?: number | null
          selected_fields?: Json | null
          selected_objects?: string[] | null
          source_id: string
          sync_frequency?: Database["public"]["Enums"]["sync_frequency"]
          updated_at?: string
        }
        Update: {
          auth_credentials?: Json | null
          auth_type?: string
          created_at?: string
          id?: string
          integration_type?: string
          last_sync_at?: string | null
          records_synced?: number | null
          selected_fields?: Json | null
          selected_objects?: string[] | null
          source_id?: string
          sync_frequency?: Database["public"]["Enums"]["sync_frequency"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: []
      }
      knowledge_sources: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          is_enabled: boolean
          last_indexed_at: string | null
          metadata: Json | null
          name: string
          priority: number
          source_type: Database["public"]["Enums"]["source_type"]
          status: Database["public"]["Enums"]["source_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_enabled?: boolean
          last_indexed_at?: string | null
          metadata?: Json | null
          name: string
          priority?: number
          source_type: Database["public"]["Enums"]["source_type"]
          status?: Database["public"]["Enums"]["source_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_enabled?: boolean
          last_indexed_at?: string | null
          metadata?: Json | null
          name?: string
          priority?: number
          source_type?: Database["public"]["Enums"]["source_type"]
          status?: Database["public"]["Enums"]["source_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_responses: {
        Row: {
          category_id: string | null
          content: string
          created_at: string
          id: string
          is_public: boolean
          share_token: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_public?: boolean
          share_token?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_public?: boolean
          share_token?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_responses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      source_analytics: {
        Row: {
          avg_relevance_score: number | null
          created_at: string
          date: string
          hits_count: number
          id: string
          queries_count: number
          source_id: string
        }
        Insert: {
          avg_relevance_score?: number | null
          created_at?: string
          date: string
          hits_count?: number
          id?: string
          queries_count?: number
          source_id: string
        }
        Update: {
          avg_relevance_score?: number | null
          created_at?: string
          date?: string
          hits_count?: number
          id?: string
          queries_count?: number
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_analytics_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string | null
          source_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
          source_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_audit_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      web_crawler_sources: {
        Row: {
          auth_credentials: Json | null
          auth_type: string | null
          crawl_depth: number
          crawl_entire_domain: boolean
          crawl_frequency: Database["public"]["Enums"]["sync_frequency"]
          created_at: string
          exclude_patterns: string[] | null
          id: string
          include_patterns: string[] | null
          last_crawl_at: string | null
          pages_crawled: number | null
          seed_url: string
          source_id: string
          updated_at: string
        }
        Insert: {
          auth_credentials?: Json | null
          auth_type?: string | null
          crawl_depth?: number
          crawl_entire_domain?: boolean
          crawl_frequency?: Database["public"]["Enums"]["sync_frequency"]
          created_at?: string
          exclude_patterns?: string[] | null
          id?: string
          include_patterns?: string[] | null
          last_crawl_at?: string | null
          pages_crawled?: number | null
          seed_url: string
          source_id: string
          updated_at?: string
        }
        Update: {
          auth_credentials?: Json | null
          auth_type?: string | null
          crawl_depth?: number
          crawl_entire_domain?: boolean
          crawl_frequency?: Database["public"]["Enums"]["sync_frequency"]
          created_at?: string
          exclude_patterns?: string[] | null
          id?: string
          include_patterns?: string[] | null
          last_crawl_at?: string | null
          pages_crawled?: number | null
          seed_url?: string
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_crawler_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_share_token: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      source_status: "idle" | "running" | "completed" | "failed" | "pending"
      source_type: "web_crawler" | "file" | "integration"
      sync_frequency: "manual" | "hourly" | "daily" | "weekly"
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
      source_status: ["idle", "running", "completed", "failed", "pending"],
      source_type: ["web_crawler", "file", "integration"],
      sync_frequency: ["manual", "hourly", "daily", "weekly"],
    },
  },
} as const
