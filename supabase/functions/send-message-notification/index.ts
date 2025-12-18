import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import { sendEmail, getAntiSpamFooter, EMAIL_CONFIG } from '../_shared/emailHelper.ts';

// Rate limiting utilities
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const limits = new Map<string, RateLimitEntry>();

const checkRateLimit = (
  key: string, 
  config: { maxRequests: number; windowMs: number }
): { allowed: boolean; remaining: number; resetTime: number } => {
  const now = Date.now();
  const entry = limits.get(key);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + config.windowMs;
    limits.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: config.maxRequests - 1, resetTime };
  }

  if (entry.count < config.maxRequests) {
    entry.count++;
    limits.set(key, entry);
    return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
  }

  return { allowed: false, remaining: 0, resetTime: entry.resetTime };
};

const getClientIdentifier = (req: Request): string => {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  return cfConnectingIp || realIp || forwarded?.split(',')[0] || 'unknown';
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  recipientId: string;
  senderName: string;
  messageContent: string;
  messageType: 'text' | 'image';
  conversationId: string;
  propertyTitle?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting: 30 requests per minute
    const clientId = getClientIdentifier(req);
    const limit = checkRateLimit(clientId, { maxRequests: 30, windowMs: 60 * 1000 });
    
    if (!limit.allowed) {
      const retryAfter = Math.ceil((limit.resetTime - Date.now()) / 1000);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', retryAfter }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': retryAfter.toString() } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: authenticatedUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authenticatedUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { recipientId, senderName, messageContent, messageType, conversationId, propertyTitle }: NotificationRequest = await req.json();

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check notification preferences
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('email_new_messages')
      .eq('user_id', recipientId)
      .single();

    if (!preferences?.email_new_messages) {
      console.log('User has email notifications disabled for new messages');
      return new Response(JSON.stringify({ message: 'Email notifications disabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(recipientId);

    if (userError || !user?.email) {
      console.error('Error fetching user email:', userError);
      return new Response(JSON.stringify({ error: 'User email not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messagePreview = messageType === 'image' 
      ? '📷 Te envió una imagen' 
      : messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : '');

    const propertyInfo = propertyTitle 
      ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 16px 0;">Propiedad: <strong>${propertyTitle}</strong></p>` 
      : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">💬 Nuevo Mensaje</h1>
    </div>
    <div style="padding: 30px;">
      <p style="color: #374151; font-size: 16px; margin-bottom: 8px;">
        <strong>${senderName}</strong> te ha enviado un mensaje:
      </p>
      ${propertyInfo}
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
        <p style="margin: 0; color: #374151; font-size: 15px;">${messagePreview}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${EMAIL_CONFIG.baseUrl}/messages?conversation=${conversationId}" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver Conversación</a>
      </div>
    </div>
    ${getAntiSpamFooter()}
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: user.email,
      subject: `Nuevo mensaje de ${senderName}`,
      htmlContent: html,
      category: 'transactional',
      tags: [
        { name: 'notification_type', value: 'new_message' },
        { name: 'conversation_id', value: conversationId },
      ],
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('Email sent successfully:', result.data);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in send-message-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
