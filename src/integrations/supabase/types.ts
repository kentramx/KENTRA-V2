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
      agency_invitations: {
        Row: {
          accepted_at: string | null
          agency_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_at: string
          invited_by: string
          role: string
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          agency_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by: string
          role?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          agency_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string
          role?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_invitations_agency_id_fkey"
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
          property_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          buyer_id: string
          created_at?: string
          id?: string
          property_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          buyer_id?: string
          created_at?: string
          id?: string
          property_id?: string | null
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
      conversion_events: {
        Row: {
          content_category: string | null
          content_name: string | null
          created_at: string
          currency: string | null
          event_source: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
          value: number | null
        }
        Insert: {
          content_category?: string | null
          content_name?: string | null
          created_at?: string
          currency?: string | null
          event_source?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
          value?: number | null
        }
        Update: {
          content_category?: string | null
          content_name?: string | null
          created_at?: string
          currency?: string | null
          event_source?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
          value?: number | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string | null
          currency: string | null
          discount_amount: number
          id: string
          plan_id: string | null
          redeemed_at: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          coupon_id?: string | null
          currency?: string | null
          discount_amount: number
          id?: string
          plan_id?: string | null
          redeemed_at?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          coupon_id?: string | null
          currency?: string | null
          discount_amount?: number
          id?: string
          plan_id?: string | null
          redeemed_at?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "promotion_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
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
      identity_verifications: {
        Row: {
          address: string | null
          admin_notes: string | null
          created_at: string
          curp: string | null
          date_of_birth: string | null
          full_name: string | null
          id: string
          ine_back_url: string | null
          ine_front_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rfc_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          created_at?: string
          curp?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          id?: string
          ine_back_url?: string | null
          ine_front_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rfc_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          created_at?: string
          curp?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          id?: string
          ine_back_url?: string | null
          ine_front_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rfc_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      kyc_verification_history: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          new_status: string
          previous_status: string
          rejection_reason: string | null
          reviewed_by: string | null
          verification_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          new_status: string
          previous_status: string
          rejection_reason?: string | null
          reviewed_by?: string | null
          verification_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          new_status?: string
          previous_status?: string
          rejection_reason?: string | null
          reviewed_by?: string | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_verification_history_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "identity_verifications"
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
          preferences: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name?: string | null
          preferences?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string | null
          preferences?: Json | null
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
      phone_verifications: {
        Row: {
          attempts: number
          blocked_until: string | null
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          last_request_at: string | null
          max_attempts: number
          phone_number: string
          request_count_hour: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          last_request_at?: string | null
          max_attempts?: number
          phone_number: string
          request_count_hour?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_request_at?: string | null
          max_attempts?: number
          phone_number?: string
          request_count_hour?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      processed_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          metadata: Json | null
          processed_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          processed_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          processed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string | null
          email_notifications: boolean | null
          id: string
          is_verified: boolean | null
          name: string
          phone: string | null
          phone_verification_code: string | null
          phone_verification_expires_at: string | null
          phone_verified: boolean | null
          phone_verified_at: string | null
          state: string | null
          updated_at: string | null
          whatsapp_business_hours: string | null
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
          whatsapp_verified: boolean | null
          whatsapp_verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          email_notifications?: boolean | null
          id: string
          is_verified?: boolean | null
          name: string
          phone?: string | null
          phone_verification_code?: string | null
          phone_verification_expires_at?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          state?: string | null
          updated_at?: string | null
          whatsapp_business_hours?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
          whatsapp_verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          is_verified?: boolean | null
          name?: string
          phone?: string | null
          phone_verification_code?: string | null
          phone_verification_expires_at?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          state?: string | null
          updated_at?: string | null
          whatsapp_business_hours?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
          whatsapp_verified_at?: string | null
        }
        Relationships: []
      }
      promotion_coupons: {
        Row: {
          applies_to: string | null
          campaign_name: string | null
          code: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_redemptions: number | null
          stripe_coupon_id: string
          stripe_promotion_code_id: string | null
          times_redeemed: number | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to?: string | null
          campaign_name?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
          stripe_coupon_id: string
          stripe_promotion_code_id?: string | null
          times_redeemed?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to?: string | null
          campaign_name?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_redemptions?: number | null
          stripe_coupon_id?: string
          stripe_promotion_code_id?: string | null
          times_redeemed?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
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
          colonia: string | null
          created_at: string | null
          currency: string
          description: string | null
          duplicate_warning: boolean | null
          duplicate_warning_data: Json | null
          expires_at: string | null
          for_rent: boolean
          for_sale: boolean
          geom: unknown
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
          property_code: string | null
          rejection_history: Json | null
          rent_price: number | null
          requires_manual_review: boolean | null
          resubmission_count: number
          sale_price: number | null
          search_vector: unknown
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
          colonia?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          duplicate_warning?: boolean | null
          duplicate_warning_data?: Json | null
          expires_at?: string | null
          for_rent?: boolean
          for_sale?: boolean
          geom?: unknown
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
          property_code?: string | null
          rejection_history?: Json | null
          rent_price?: number | null
          requires_manual_review?: boolean | null
          resubmission_count?: number
          sale_price?: number | null
          search_vector?: unknown
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
          colonia?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          duplicate_warning?: boolean | null
          duplicate_warning_data?: Json | null
          expires_at?: string | null
          for_rent?: boolean
          for_sale?: boolean
          geom?: unknown
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
          property_code?: string | null
          rejection_history?: Json | null
          rent_price?: number | null
          requires_manual_review?: boolean | null
          resubmission_count?: number
          sale_price?: number | null
          search_vector?: unknown
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
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
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
      trial_tracking: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          trial_started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          trial_started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          trial_started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      upsells: {
        Row: {
          badge: string | null
          created_at: string
          description: string
          display_order: number
          icon_name: string
          id: string
          is_active: boolean
          is_recurring: boolean
          name: string
          price: number
          quantity_per_upsell: number | null
          stripe_price_id: string
          updated_at: string
          upsell_type: string | null
          user_type: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          description: string
          display_order?: number
          icon_name?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name: string
          price: number
          quantity_per_upsell?: number | null
          stripe_price_id: string
          updated_at?: string
          upsell_type?: string | null
          user_type: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          description?: string
          display_order?: number
          icon_name?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name?: string
          price?: number
          quantity_per_upsell?: number | null
          stripe_price_id?: string
          updated_at?: string
          upsell_type?: string | null
          user_type?: string
        }
        Relationships: []
      }
      user_active_upsells: {
        Row: {
          auto_renew: boolean
          created_at: string
          end_date: string | null
          id: string
          quantity: number
          start_date: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          upsell_id: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          quantity?: number
          start_date?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          upsell_id: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          quantity?: number
          start_date?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          upsell_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_upsells_upsell_id_fkey"
            columns: ["upsell_id"]
            isOneToOne: false
            referencedRelation: "upsells"
            referencedColumns: ["id"]
          },
        ]
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
          featured_reset_date: string | null
          featured_used_this_month: number | null
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
          featured_reset_date?: string | null
          featured_used_this_month?: number | null
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
          featured_reset_date?: string | null
          featured_used_this_month?: number | null
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
      agent_performance_stats: {
        Row: {
          active_properties: number | null
          agent_id: string | null
          avg_price: number | null
          avg_rating: number | null
          last_property_date: string | null
          total_conversations: number | null
          total_favorites: number | null
          total_properties: number | null
          total_reviews: number | null
          total_views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      property_stats_by_municipality: {
        Row: {
          active_properties: number | null
          avg_price: number | null
          avg_sqft: number | null
          max_price: number | null
          min_price: number | null
          municipality: string | null
          properties_for_rent: number | null
          properties_for_sale: number | null
          state: string | null
          total_agents: number | null
          total_properties: number | null
        }
        Relationships: []
      }
      property_stats_by_state: {
        Row: {
          active_properties: number | null
          avg_price: number | null
          max_price: number | null
          min_price: number | null
          state: string | null
          total_agents: number | null
          total_municipalities: number | null
          total_properties: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
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
      can_create_property_with_upsells: {
        Args: { user_uuid: string }
        Returns: {
          additional_slots: number
          can_create: boolean
          current_count: number
          max_allowed: number
          reason: string
        }[]
      }
      can_feature_property: {
        Args: { user_uuid: string }
        Returns: {
          can_feature: boolean
          featured_limit: number
          featured_used: number
          plan_name: string
          reason: string
        }[]
      }
      can_get_trial: {
        Args: { p_device_fingerprint?: string; p_ip_address?: string }
        Returns: {
          can_trial: boolean
          previous_trials: number
          reason: string
        }[]
      }
      change_user_role: {
        Args: { new_role: Database["public"]["Enums"]["app_role"] }
        Returns: Json
      }
      cleanup_old_data: { Args: never; Returns: undefined }
      database_health_check: {
        Args: never
        Returns: {
          metric: string
          status: string
          value: string
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      dropgeometrytable:
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_old_invitations: { Args: never; Returns: undefined }
      generate_property_code: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
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
      get_churn_metrics: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      get_financial_metrics: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      get_images_batch: {
        Args: { property_ids: string[] }
        Returns: {
          images: Json
          property_id: string
        }[]
      }
      get_marketing_metrics: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      get_municipality_stats: {
        Args: { p_municipality: string; p_state: string }
        Returns: {
          active_properties: number
          avg_price: number
          avg_sqft: number
          max_price: number
          min_price: number
          municipality: string
          properties_for_rent: number
          properties_for_sale: number
          state: string
          total_agents: number
          total_properties: number
        }[]
      }
      get_properties_cursor: {
        Args: {
          p_cursor?: string
          p_limit?: number
          p_listing_type?: string
          p_municipality?: string
          p_price_max?: number
          p_price_min?: number
          p_state?: string
          p_type?: string
        }
        Returns: {
          address: string
          agent_id: string
          bathrooms: number
          bedrooms: number
          created_at: string
          currency: string
          for_rent: boolean
          for_sale: boolean
          id: string
          lat: number
          listing_type: string
          lng: number
          municipality: string
          next_cursor: string
          parking: number
          price: number
          rent_price: number
          sale_price: number
          sqft: number
          state: string
          title: string
          type: Database["public"]["Enums"]["property_type"]
        }[]
      }
      get_properties_in_viewport: {
        Args: {
          max_lat: number
          max_lng: number
          min_lat: number
          min_lng: number
          p_bathrooms?: number
          p_bedrooms?: number
          p_listing_type?: string
          p_municipality?: string
          p_price_max?: number
          p_price_min?: number
          p_state?: string
          p_status?: string
          p_type?: string
        }
        Returns: {
          address: string
          agent_id: string
          bathrooms: number
          bedrooms: number
          created_at: string
          id: string
          images: Json
          is_featured: boolean
          lat: number
          listing_type: string
          lng: number
          municipality: string
          parking: number
          price: number
          sqft: number
          state: string
          status: string
          title: string
          type: string
        }[]
      }
      get_property_clusters: {
        Args: {
          max_lat: number
          max_lng: number
          min_lat: number
          min_lng: number
          p_bathrooms?: number
          p_bedrooms?: number
          p_listing_type?: string
          p_municipality?: string
          p_price_max?: number
          p_price_min?: number
          p_state?: string
          p_status?: string
          p_type?: string
          zoom_level: number
        }
        Returns: {
          avg_price: number
          cluster_id: string
          lat: number
          lng: number
          property_count: number
          property_ids: string[]
        }[]
      }
      get_state_stats: {
        Args: { p_state: string }
        Returns: {
          active_properties: number
          avg_price: number
          max_price: number
          min_price: number
          state: string
          total_agents: number
          total_municipalities: number
          total_properties: number
        }[]
      }
      get_system_health_metrics: { Args: never; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_subscription_info: {
        Args: { user_uuid: string }
        Returns: {
          cancel_at_period_end: boolean
          current_period_end: string
          display_name: string
          featured_limit: number
          featured_used: number
          features: Json
          has_subscription: boolean
          name: string
          properties_limit: number
          properties_used: number
          status: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_admin_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_messages_as_read: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      populate_geometry_columns:
        | { Args: { use_typmod?: boolean }; Returns: string }
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      promote_user_to_admin: {
        Args: {
          new_admin_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      reactivate_property: { Args: { property_id: string }; Returns: undefined }
      refresh_agent_stats: { Args: never; Returns: undefined }
      renew_property: { Args: { property_id: string }; Returns: undefined }
      resubmit_property: { Args: { property_id: string }; Returns: Json }
      search_properties_fts: {
        Args: {
          p_limit?: number
          p_listing_type?: string
          p_municipality?: string
          p_offset?: number
          p_price_max?: number
          p_price_min?: number
          p_state?: string
          p_type?: string
          search_query: string
        }
        Returns: {
          address: string
          agent_id: string
          bathrooms: number
          bedrooms: number
          created_at: string
          id: string
          lat: number
          listing_type: string
          lng: number
          municipality: string
          parking: number
          price: number
          rank: number
          sqft: number
          state: string
          title: string
          type: Database["public"]["Enums"]["property_type"]
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_askml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geom: unknown }; Returns: number }
        | { Args: { geog: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      validate_coupon: {
        Args: { p_code: string; p_plan_type?: string; p_user_id: string }
        Returns: {
          coupon_id: string
          discount_type: string
          discount_value: number
          is_valid: boolean
          message: string
          stripe_coupon_id: string
        }[]
      }
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
      invitation_status: "pending" | "accepted" | "rejected" | "expired"
      moderation_action:
        | "approved"
        | "rejected"
        | "resubmitted"
        | "auto_approved"
      property_status:
        | "activa"
        | "vendida"
        | "rentada"
        | "pausada"
        | "pendiente_aprobacion"
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
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      invitation_status: ["pending", "accepted", "rejected", "expired"],
      moderation_action: [
        "approved",
        "rejected",
        "resubmitted",
        "auto_approved",
      ],
      property_status: [
        "activa",
        "vendida",
        "rentada",
        "pausada",
        "pendiente_aprobacion",
      ],
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
