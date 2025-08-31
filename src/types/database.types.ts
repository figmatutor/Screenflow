// ============================================================================
// Supabase Database Types
// 자동 생성된 타입 정의 파일
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          created_at: string
          updated_at: string
          subscription_tier: 'free' | 'pro' | 'enterprise'
          storage_used: number
          storage_limit: number
          birth: string | null
          address: string | null
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
          subscription_tier?: 'free' | 'pro' | 'enterprise'
          storage_used?: number
          storage_limit?: number
          birth?: string | null
          address?: string | null
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
          subscription_tier?: 'free' | 'pro' | 'enterprise'
          storage_used?: number
          storage_limit?: number
          birth?: string | null
          address?: string | null
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          auto_archive: boolean
          default_capture_type: 'auto-flow' | 'smart-capture' | 'interactive' | 'capture-flow'
          notification_email: boolean
          storage_cleanup_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          auto_archive?: boolean
          default_capture_type?: 'auto-flow' | 'smart-capture' | 'interactive' | 'capture-flow'
          notification_email?: boolean
          storage_cleanup_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          auto_archive?: boolean
          default_capture_type?: 'auto-flow' | 'smart-capture' | 'interactive' | 'capture-flow'
          notification_email?: boolean
          storage_cleanup_days?: number
          created_at?: string
          updated_at?: string
        }
      }
      capture_sessions: {
        Row: {
          id: string
          user_id: string
          url: string
          title: string | null
          description: string | null
          capture_type: 'auto-flow' | 'smart-capture' | 'interactive' | 'capture-flow' | 'auto-capture-zip'
          status: 'pending' | 'processing' | 'completed' | 'failed'
          metadata: Json
          error_message: string | null
          total_screenshots: number
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          title?: string | null
          description?: string | null
          capture_type: 'auto-flow' | 'smart-capture' | 'interactive' | 'capture-flow' | 'auto-capture-zip'
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          metadata?: Json
          error_message?: string | null
          total_screenshots?: number
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          title?: string | null
          description?: string | null
          capture_type?: 'auto-flow' | 'smart-capture' | 'interactive' | 'capture-flow' | 'auto-capture-zip'
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          metadata?: Json
          error_message?: string | null
          total_screenshots?: number
          created_at?: string
          completed_at?: string | null
        }
      }
      screenshots: {
        Row: {
          id: string
          session_id: string
          user_id: string
          file_path: string
          file_name: string
          file_size: number
          width: number | null
          height: number | null
          page_url: string
          element_selector: string | null
          element_description: string | null
          order_index: number
          is_archived: boolean
          thumbnail_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          file_path: string
          file_name: string
          file_size: number
          width?: number | null
          height?: number | null
          page_url: string
          element_selector?: string | null
          element_description?: string | null
          order_index?: number
          is_archived?: boolean
          thumbnail_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          file_path?: string
          file_name?: string
          file_size?: number
          width?: number | null
          height?: number | null
          page_url?: string
          element_selector?: string | null
          element_description?: string | null
          order_index?: number
          is_archived?: boolean
          thumbnail_path?: string | null
          created_at?: string
        }
      }
      archives: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          is_public: boolean
          tags: string[]
          cover_image_path: string | null
          item_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          is_public?: boolean
          tags?: string[]
          cover_image_path?: string | null
          item_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          is_public?: boolean
          tags?: string[]
          cover_image_path?: string | null
          item_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      archive_items: {
        Row: {
          id: string
          archive_id: string
          screenshot_id: string
          order_index: number
          notes: string | null
          added_at: string
        }
        Insert: {
          id?: string
          archive_id: string
          screenshot_id: string
          order_index?: number
          notes?: string | null
          added_at?: string
        }
        Update: {
          id?: string
          archive_id?: string
          screenshot_id?: string
          order_index?: number
          notes?: string | null
          added_at?: string
        }
      }
      recommended_services: {
        Row: {
          id: string
          session_id: string
          service_name: string
          service_url: string
          service_description: string | null
          category: 'design' | 'development' | 'marketing' | 'analytics' | 'productivity' | 'tools' | 'inspiration' | null
          relevance_score: number | null
          service_logo_url: string | null
          pricing_model: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          service_name: string
          service_url: string
          service_description?: string | null
          category?: 'design' | 'development' | 'marketing' | 'analytics' | 'productivity' | 'tools' | 'inspiration' | null
          relevance_score?: number | null
          service_logo_url?: string | null
          pricing_model?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          service_name?: string
          service_url?: string
          service_description?: string | null
          category?: 'design' | 'development' | 'marketing' | 'analytics' | 'productivity' | 'tools' | 'inspiration' | null
          relevance_score?: number | null
          service_logo_url?: string | null
          pricing_model?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// 편의를 위한 타입 별칭
export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert']
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update']

export type CaptureSession = Database['public']['Tables']['capture_sessions']['Row']
export type CaptureSessionInsert = Database['public']['Tables']['capture_sessions']['Insert']
export type CaptureSessionUpdate = Database['public']['Tables']['capture_sessions']['Update']

export type Screenshot = Database['public']['Tables']['screenshots']['Row']
export type ScreenshotInsert = Database['public']['Tables']['screenshots']['Insert']
export type ScreenshotUpdate = Database['public']['Tables']['screenshots']['Update']

export type Archive = Database['public']['Tables']['archives']['Row']
export type ArchiveInsert = Database['public']['Tables']['archives']['Insert']
export type ArchiveUpdate = Database['public']['Tables']['archives']['Update']

export type ArchiveItem = Database['public']['Tables']['archive_items']['Row']
export type ArchiveItemInsert = Database['public']['Tables']['archive_items']['Insert']
export type ArchiveItemUpdate = Database['public']['Tables']['archive_items']['Update']

export type RecommendedService = Database['public']['Tables']['recommended_services']['Row']
export type RecommendedServiceInsert = Database['public']['Tables']['recommended_services']['Insert']
export type RecommendedServiceUpdate = Database['public']['Tables']['recommended_services']['Update']

// 캡처 타입 상수
export const CAPTURE_TYPES = {
  AUTO_FLOW: 'auto-flow',
  SMART_CAPTURE: 'smart-capture',
  INTERACTIVE: 'interactive',
  CAPTURE_FLOW: 'capture-flow',
  AUTO_CAPTURE_ZIP: 'auto-capture-zip'
} as const

// 세션 상태 상수
export const SESSION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const

// 구독 티어 상수
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
} as const

// 서비스 카테고리 상수
export const SERVICE_CATEGORIES = {
  DESIGN: 'design',
  DEVELOPMENT: 'development',
  MARKETING: 'marketing',
  ANALYTICS: 'analytics',
  PRODUCTIVITY: 'productivity',
  TOOLS: 'tools',
  INSPIRATION: 'inspiration'
} as const
