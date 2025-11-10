import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components';
import * as React from 'react';

interface ExpiryReminderEmailProps {
  agentName: string;
  propertyTitle: string;
  daysUntilExpiry: number;
  expiryDate: string;
  renewUrl: string;
}

export const ExpiryReminderEmail = ({
  agentName = 'Agente',
  propertyTitle = 'Tu propiedad',
  daysUntilExpiry = 7,
  expiryDate = '31 de diciembre de 2024',
  renewUrl = 'https://kentra.com.mx/agent/dashboard',
}: ExpiryReminderEmailProps) => {
  const urgencyColor = daysUntilExpiry === 1 ? '#dc2626' : daysUntilExpiry === 3 ? '#ea580c' : '#ca8a04';
  const urgencyEmoji = daysUntilExpiry === 1 ? '🚨' : daysUntilExpiry === 3 ? '⚠️' : '⏰';

  return (
    <Html>
      <Head />
      <Preview>
        {urgencyEmoji} Tu propiedad expira en {daysUntilExpiry} día{daysUntilExpiry > 1 ? 's' : ''} - Renueva ahora
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={header}>
            <Text style={logoText}>KENTRA</Text>
          </Section>

          {/* Urgency Badge */}
          <Section style={{ ...urgencyBadge, backgroundColor: urgencyColor }}>
            <Text style={urgencyText}>
              {urgencyEmoji} EXPIRA EN {daysUntilExpiry} DÍA{daysUntilExpiry > 1 ? 'S' : ''}
            </Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>Hola {agentName},</Heading>
            
            <Text style={text}>
              Te recordamos que tu propiedad <strong>"{propertyTitle}"</strong> está próxima a expirar.
            </Text>

            <Section style={infoBox}>
              <Text style={infoLabel}>📅 Fecha de expiración:</Text>
              <Text style={infoValue}>{expiryDate}</Text>
              <Text style={infoLabel}>⏱️ Tiempo restante:</Text>
              <Text style={{ ...infoValue, color: urgencyColor, fontWeight: '700' }}>
                {daysUntilExpiry} día{daysUntilExpiry > 1 ? 's' : ''}
              </Text>
            </Section>

            {daysUntilExpiry === 1 && (
              <Section style={urgentNotice}>
                <Text style={urgentNoticeText}>
                  <strong>⚡ URGENTE:</strong> Si no renuevas hoy, tu propiedad se pausará mañana y dejará de ser visible para compradores.
                </Text>
              </Section>
            )}

            <Text style={text}>
              {daysUntilExpiry === 7 && '¿Tu propiedad sigue activa? Renuévala con un solo clic para mantenerla visible en nuestro catálogo por 30 días más.'}
              {daysUntilExpiry === 3 && 'Tu propiedad está a punto de pausarse. Renuévala ahora para mantenerla activa y seguir recibiendo contactos.'}
              {daysUntilExpiry === 1 && 'Este es tu último día para renovar antes de que tu propiedad se pause automáticamente.'}
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={renewUrl}>
                🔄 Renovar Propiedad Ahora
              </Button>
            </Section>

            <Section style={benefitsBox}>
              <Text style={benefitsTitle}>✨ Al renovar tu propiedad:</Text>
              <Text style={benefitItem}>✓ Permanece visible por 30 días más</Text>
              <Text style={benefitItem}>✓ Mantiene su posición en búsquedas</Text>
              <Text style={benefitItem}>✓ Continúa recibiendo contactos</Text>
              <Text style={benefitItem}>✓ La información se mantiene actualizada</Text>
            </Section>

            <Text style={reminder}>
              <strong>Recuerda:</strong> Las propiedades deben renovarse cada 30 días para garantizar que la información está actualizada. Si no renuevas, tu propiedad se pausará automáticamente pero podrás reactivarla cuando lo necesites.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              ¿Necesitas ayuda? Contáctanos en{' '}
              <Link href="mailto:soporte@kentra.com.mx" style={link}>
                soporte@kentra.com.mx
              </Link>
            </Text>
            <Text style={footerText}>
              Síguenos: Instagram{' '}
              <Link href="https://instagram.com/kentra.mx" style={link}>
                @kentra.mx
              </Link>{' '}
              | Facebook{' '}
              <Link href="https://facebook.com/kentra.mx" style={link}>
                Kentra
              </Link>
            </Text>
            <Text style={footerSmall}>
              © {new Date().getFullYear()} Kentra. Todos los derechos reservados.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default ExpiryReminderEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  padding: '20px 0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
};

const header = {
  backgroundColor: '#0f172a',
  padding: '32px 40px',
  textAlign: 'center' as const,
};

const logoText = {
  fontSize: '32px',
  fontWeight: '800',
  color: '#ffffff',
  margin: '0',
  letterSpacing: '2px',
};

const urgencyBadge = {
  padding: '16px 40px',
  textAlign: 'center' as const,
};

const urgencyText = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
};

const content = {
  padding: '40px',
};

const h1 = {
  color: '#1e293b',
  fontSize: '26px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 24px',
};

const text = {
  color: '#475569',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const infoBox = {
  backgroundColor: '#f8fafc',
  borderLeft: '4px solid #3b82f6',
  padding: '20px',
  margin: '24px 0',
  borderRadius: '4px',
};

const infoLabel = {
  color: '#64748b',
  fontSize: '14px',
  margin: '0 0 4px',
  fontWeight: '600',
};

const infoValue = {
  color: '#1e293b',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px',
};

const urgentNotice = {
  backgroundColor: '#fef2f2',
  border: '2px solid #dc2626',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
};

const urgentNoticeText = {
  color: '#991b1b',
  fontSize: '15px',
  margin: '0',
  lineHeight: '1.5',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 40px',
  cursor: 'pointer',
  border: 'none',
};

const benefitsBox = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #86efac',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const benefitsTitle = {
  color: '#15803d',
  fontSize: '16px',
  fontWeight: '700',
  margin: '0 0 12px',
};

const benefitItem = {
  color: '#166534',
  fontSize: '15px',
  margin: '0 0 8px',
  lineHeight: '1.5',
};

const reminder = {
  backgroundColor: '#fffbeb',
  borderLeft: '4px solid #fbbf24',
  padding: '16px',
  margin: '24px 0',
  fontSize: '14px',
  color: '#78350f',
  lineHeight: '1.6',
  borderRadius: '4px',
};

const footer = {
  backgroundColor: '#f8fafc',
  padding: '32px 40px',
  textAlign: 'center' as const,
  borderTop: '1px solid #e2e8f0',
};

const footerText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 8px',
};

const footerSmall = {
  color: '#94a3b8',
  fontSize: '12px',
  margin: '16px 0 0',
};

const link = {
  color: '#3b82f6',
  textDecoration: 'underline',
};
