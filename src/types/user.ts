/**
 * Tipos para usuarios, agentes y agencias
 */

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  whatsapp_number: string | null;
  whatsapp_enabled: boolean | null;
  whatsapp_verified: boolean | null;
  city: string | null;
  state: string | null;
  is_verified: boolean | null;
  created_at: string;
  updated_at: string | null;
}

export interface AgentProfile {
  id: string;
  name: string;
  email?: string;
  phone: string | null;
  whatsapp_number: string | null;
  whatsapp_enabled: boolean | null;
  is_verified: boolean | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
}

export interface AgencyAgent {
  id: string;
  agency_id: string;
  agent_id: string;
  role: 'agent' | 'manager' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  joined_at: string;
  profiles?: AgentProfile;
}

export interface AgencyInvitation {
  id: string;
  agency_id: string;
  email: string;
  role: 'agent' | 'manager';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  token: string;
  invited_by: string;
  invited_at: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Agency {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  is_verified: boolean | null;
  created_at: string;
  updated_at: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'moderator' | 'admin';
  granted_at: string;
  granted_by: string;
}

export interface KYCVerification {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  ine_front_url?: string;
  ine_back_url?: string;
  rfc_url?: string;
  full_name?: string;
  curp?: string;
  date_of_birth?: string;
  address?: string;
  rejection_reason?: string;
  admin_notes?: string;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  profiles?: {
    name: string;
    email?: string;
  };
}
