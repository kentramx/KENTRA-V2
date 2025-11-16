// Tipos relacionados con usuarios

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  phone_verified_at: string | null;
  city: string | null;
  state: string | null;
  is_verified: boolean | null;
  email_notifications: boolean | null;
  whatsapp_enabled: boolean | null;
  whatsapp_number: string | null;
  whatsapp_verified: boolean | null;
  whatsapp_verified_at: string | null;
  whatsapp_business_hours: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AgentProfile extends User {
  total_properties?: number;
  active_properties?: number;
  rating?: number;
  review_count?: number;
  agency_id?: string | null;
  agency_name?: string | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  granted_at: string | null;
  granted_by: string | null;
}

export type AppRole = 
  | 'buyer' 
  | 'agent' 
  | 'agency' 
  | 'admin' 
  | 'moderator' 
  | 'super_admin';
