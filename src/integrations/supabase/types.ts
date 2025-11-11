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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_notification_preferences: {
        Row: {
          created_at: string
          id: string
          notify_on_bypass: boolean
          notify_on_downgrade: boolean
          notify_on_upgrade: boolean
          updated_at: string
          use_email: boolean
          use_sound: boolean
          use_toast: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_on_bypass?: boolean
          notify_on_downgrade?: boolean
          notify_on_upgrade?: boolean
          updated_at?: string
          use_email?: boolean
          use_sound?: boolean
          use_toast?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_on_bypass?: boolean
          notify_on_downgrade?: boolean
          notify_on_upgrade?: boolean
          updated_at?: string
          use_email?: boolean
          use_sound?: boolean
          use_toast?: boolean
          user_id?: string
        }
        Relationships: []
      }
      agencies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          is_verified: boolean | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          state: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      agency_agents: {
        Row: {
          agency_id: string
          agent_id: string
          id: string
          joined_at: string | null
          role: string | null
          status: string | null
        }
        Insert: {
          agency_id: string
          agent_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          status?: string | null
        }
        Update: {
          agency_id?: string
          agent_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_agents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_reviews: {
        Row: {
          agent_id: string
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          property_id: string | null
          rating: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          rating: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_reviews_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reviews_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_definitions: {
        Row: {
          code: string
          color: string
          created_at: string
          description: string
          icon: string
          id: string
          is_secret: boolean | null
          name: string
          priority: number
          requirements: Json
        }
        Insert: {
          code: string
          color: string
          created_at?: string
          description: string
          icon: string
          id?: string
          is_secret?: boolean | null
          name: string
          priority?: number
          requirements?: Json
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_secret?: boolean | null
          name?: string
          priority?: number
          requirements?: Json
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          last_read_at: string | null
          unread_count: number
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          last_read_at?: string | null
          unread_count?: number
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          last_read_at?: string | null
          unread_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_id: string
          buyer_id: string
          created_at: string
          id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          buyer_id: string
          created_at?: string
          id?: string
          property_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          buyer_id?: string
          created_at?: string
          id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_setup_log: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_properties: {
        Row: {
          agent_id: string
          clicks: number | null
          cost: number | null
          created_at: string | null
          end_date: string
          featured_type: string
          id: string
          impressions: number | null
          position: number | null
          property_id: string
          start_date: string | null
          status: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          agent_id: string
          clicks?: number | null
          cost?: number | null
          created_at?: string | null
          end_date: string
          featured_type?: string
          id?: string
          impressions?: number | null
          position?: number | null
          property_id: string
          start_date?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          agent_id?: string
          clicks?: number | null
          cost?: number | null
          created_at?: string | null
          end_date?: string
          featured_type?: string
          id?: string
          impressions?: number | null
          position?: number | null
          property_id?: string
          start_date?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      image_ai_analysis: {
        Row: {
          ai_notes: string | null
          analyzed_at: string
          composition_score: number | null
          created_at: string
          detected_issues: string[] | null
          id: string
          image_id: string
          is_blurry: boolean | null
          is_dark: boolean | null
          is_inappropriate: boolean | null
          is_manipulated: boolean | null
          lighting_score: number | null
          property_id: string
          quality_score: number | null
          resolution_score: number | null
        }
        Insert: {
          ai_notes?: string | null
          analyzed_at?: string
          composition_score?: number | null
          created_at?: string
          detected_issues?: string[] | null
          id?: string
          image_id: string
          is_blurry?: boolean | null
          is_dark?: boolean | null
          is_inappropriate?: boolean | null
          is_manipulated?: boolean | null
          lighting_score?: number | null
          property_id: string
          quality_score?: number | null
          resolution_score?: number | null
        }
        Update: {
          ai_notes?: string | null
          analyzed_at?: string
          composition_score?: number | null
          created_at?: string
          detected_issues?: string[] | null
          id?: string
          image_id?: string
          is_blurry?: boolean | null
          is_dark?: boolean | null
          is_inappropriate?: boolean | null
          is_manipulated?: boolean | null
          lighting_score?: number | null
          property_id?: string
          quality_score?: number | null
          resolution_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_ai_analysis_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_ai_analysis_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          created_at: string | null
          id: string
          position: number | null
          property_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          position?: number | null
          property_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          position?: number | null
          property_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          message_type: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          message_type?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          message_type?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriptions: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string | null
          preferences: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name?: string | null
          preferences?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string | null
          preferences?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_new_messages: boolean | null
          email_new_properties: boolean | null
          email_price_changes: boolean | null
          email_saved_searches: boolean | null
          email_weekly_digest: boolean | null
          id: string
          push_new_messages: boolean | null
          push_new_properties: boolean | null
          push_price_changes: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_new_messages?: boolean | null
          email_new_properties?: boolean | null
          email_price_changes?: boolean | null
          email_saved_searches?: boolean | null
          email_weekly_digest?: boolean | null
          id?: string
          push_new_messages?: boolean | null
          push_new_properties?: boolean | null
          push_price_changes?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_new_messages?: boolean | null
          email_new_properties?: boolean | null
          email_price_changes?: boolean | null
          email_saved_searches?: boolean | null
          email_weekly_digest?: boolean | null
          id?: string
          push_new_messages?: boolean | null
          push_new_properties?: boolean | null
          push_price_changes?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          metadata: Json | null
          payment_type: string
          status: string
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          payment_type: string
          status: string
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          payment_type?: string
          status?: string
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email_notifications: boolean | null
          id: string
          is_verified: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
          whatsapp_business_hours: string | null
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string | null
          email_notifications?: boolean | null
          id: string
          is_verified?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string | null
          whatsapp_business_hours?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          is_verified?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
          whatsapp_business_hours?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          agency_id: string | null
          agent_id: string
          ai_moderated_at: string | null
          ai_moderation_notes: string | null
          ai_moderation_score: number | null
          ai_moderation_status:
            | Database["public"]["Enums"]["ai_moderation_status"]
            | null
          amenities: Json | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          has_inappropriate_images: boolean | null
          has_manipulated_images: boolean | null
          id: string
          images_analyzed_count: number | null
          images_quality_avg: number | null
          last_renewed_at: string | null
          lat: number | null
          listing_type: string
          lng: number | null
          lot_size: number | null
          municipality: string
          parking: number | null
          price: number
          price_history: Json | null
          sqft: number | null
          state: string
          status: Database["public"]["Enums"]["property_status"] | null
          title: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          address: string
          agency_id?: string | null
          agent_id: string
          ai_moderated_at?: string | null
          ai_moderation_notes?: string | null
          ai_moderation_score?: number | null
          ai_moderation_status?:
            | Database["public"]["Enums"]["ai_moderation_status"]
            | null
          amenities?: Json | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          has_inappropriate_images?: boolean | null
          has_manipulated_images?: boolean | null
          id?: string
          images_analyzed_count?: number | null
          images_quality_avg?: number | null
          last_renewed_at?: string | null
          lat?: number | null
          listing_type?: string
          lng?: number | null
          lot_size?: number | null
          municipality: string
          parking?: number | null
          price: number
          price_history?: Json | null
          sqft?: number | null
          state: string
          status?: Database["public"]["Enums"]["property_status"] | null
          title: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          address?: string
          agency_id?: string | null
          agent_id?: string
          ai_moderated_at?: string | null
          ai_moderation_notes?: string | null
          ai_moderation_score?: number | null
          ai_moderation_status?:
            | Database["public"]["Enums"]["ai_moderation_status"]
            | null
          amenities?: Json | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          has_inappropriate_images?: boolean | null
          has_manipulated_images?: boolean | null
          id?: string
          images_analyzed_count?: number | null
          images_quality_avg?: number | null
          last_renewed_at?: string | null
          lat?: number | null
          listing_type?: string
          lng?: number | null
          lot_size?: number | null
          municipality?: string
          parking?: number | null
          price?: number
          price_history?: Json | null
          sqft?: number | null
          state?: string
          status?: Database["public"]["Enums"]["property_status"] | null
          title?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_assignment_history: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          new_agent_id: string
          notes: string | null
          previous_agent_id: string | null
          property_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          new_agent_id: string
          notes?: string | null
          previous_agent_id?: string | null
          property_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          new_agent_id?: string
          notes?: string | null
          previous_agent_id?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_assignment_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_expiration_log: {
        Row: {
          agent_id: string
          expired_at: string | null
          id: string
          last_renewed_at: string
          property_created_at: string
          property_id: string
          property_title: string
        }
        Insert: {
          agent_id: string
          expired_at?: string | null
          id?: string
          last_renewed_at: string
          property_created_at: string
          property_id: string
          property_title: string
        }
        Update: {
          agent_id?: string
          expired_at?: string | null
          id?: string
          last_renewed_at?: string
          property_created_at?: string
          property_id?: string
          property_title?: string
        }
        Relationships: []
      }
      property_expiry_reminders: {
        Row: {
          agent_id: string
          days_before: number
          id: string
          property_id: string
          sent_at: string
        }
        Insert: {
          agent_id: string
          days_before: number
          id?: string
          property_id: string
          sent_at?: string
        }
        Update: {
          agent_id?: string
          days_before?: number
          id?: string
          property_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_expiry_reminders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_moderation_history: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action"]
          admin_id: string | null
          agent_id: string
          created_at: string
          id: string
          notes: string | null
          previous_data: Json | null
          property_id: string
          rejection_reason: Json | null
        }
        Insert: {
          action: Database["public"]["Enums"]["moderation_action"]
          admin_id?: string | null
          agent_id: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_data?: Json | null
          property_id: string
          rejection_reason?: Json | null
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action"]
          admin_id?: string | null
          agent_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_data?: Json | null
          property_id?: string
          rejection_reason?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "property_moderation_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_views: {
        Row: {
          id: string
          ip_address: string | null
          property_id: string
          user_agent: string | null
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          property_id: string
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          property_id?: string
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_views_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_changes: {
        Row: {
          change_type: string
          changed_at: string
          id: string
          metadata: Json | null
          new_billing_cycle: string
          new_plan_id: string
          previous_billing_cycle: string | null
          previous_plan_id: string | null
          prorated_amount: number | null
          user_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          id?: string
          metadata?: Json | null
          new_billing_cycle: string
          new_plan_id: string
          previous_billing_cycle?: string | null
          previous_plan_id?: string | null
          prorated_amount?: number | null
          user_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          id?: string
          metadata?: Json | null
          new_billing_cycle?: string
          new_plan_id?: string
          previous_billing_cycle?: string | null
          previous_plan_id?: string | null
          prorated_amount?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_changes_new_plan_id_fkey"
            columns: ["new_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_changes_previous_plan_id_fkey"
            columns: ["previous_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          display_name: string
          features: Json
          id: string
          is_active: boolean | null
          name: string
          price_monthly: number
          price_yearly: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_name: string
          features?: Json
          id?: string
          is_active?: boolean | null
          name: string
          price_monthly: number
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_name?: string
          features?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_code: string
          earned_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_interactions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          interaction_type: string
          property_id: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          interaction_type: string
          property_id?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          interaction_type?: string
          property_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_interactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_assign_badges: { Args: { p_user_id: string }; Returns: undefined }
      calculate_property_images_score: {
        Args: { p_property_id: string }
        Returns: number
      }
      can_create_property: {
        Args: { user_uuid: string }
        Returns: {
          can_create: boolean
          current_count: number
          max_allowed: number
          reason: string
        }[]
      }
      change_user_role: {
        Args: { new_role: Database["public"]["Enums"]["app_role"] }
        Returns: Json
      }
      get_agent_stats: {
        Args: { agent_uuid: string }
        Returns: {
          active_properties: number
          conversion_rate: number
          total_conversations: number
          total_favorites: number
          total_properties: number
          total_views: number
        }[]
      }
      get_auto_approval_stats: {
        Args: never
        Returns: {
          auto_approved_by_ai: number
          auto_approved_legacy: number
          avg_ai_score_auto_approved: number
          total_auto_approved: number
        }[]
      }
      get_financial_metrics: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_subscription_info: {
        Args: { user_uuid: string }
        Returns: {
          current_period_end: string
          featured_limit: number
          featured_used: number
          features: Json
          has_subscription: boolean
          plan_display_name: string
          plan_name: string
          properties_limit: number
          properties_used: number
          status: string
        }[]
      }
      has_admin_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_messages_as_read: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      renew_property: { Args: { property_id: string }; Returns: undefined }
    }
    Enums: {
      ai_moderation_status: "pass" | "review" | "reject" | "pending"
      app_role:
        | "buyer"
        | "agent"
        | "agency"
        | "admin"
        | "super_admin"
        | "moderator"
      moderation_action:
        | "approved"
        | "rejected"
        | "resubmitted"
        | "auto_approved"
      property_status: "activa" | "vendida" | "rentada" | "pausada"
      property_type:
        | "casa"
        | "departamento"
        | "terreno"
        | "oficina"
        | "local_comercial"
        | "local"
        | "bodega"
        | "edificio"
        | "rancho"
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
      ai_moderation_status: ["pass", "review", "reject", "pending"],
      app_role: [
        "buyer",
        "agent",
        "agency",
        "admin",
        "super_admin",
        "moderator",
      ],
      moderation_action: [
        "approved",
        "rejected",
        "resubmitted",
        "auto_approved",
      ],
      property_status: ["activa", "vendida", "rentada", "pausada"],
      property_type: [
        "casa",
        "departamento",
        "terreno",
        "oficina",
        "local_comercial",
        "local",
        "bodega",
        "edificio",
        "rancho",
      ],
    },
  },
} as const
