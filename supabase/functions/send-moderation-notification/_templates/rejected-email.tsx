import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface RejectedEmailProps {
  agentName: string;
  propertyTitle: string;
  rejectionReason: {
    label: string;
    details?: string;
  };
}

export const RejectedEmail = ({
  agentName,
  propertyTitle,
  rejectionReason,
}: RejectedEmailProps) => (
  <Html>
    <Head />
    <Preview>Tu propiedad {propertyTitle} necesita correcciones</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>Hola {agentName}</Heading>
        </Section>
        
        <Section style={content}>
          <Text style={paragraph}>
            Tu propiedad <strong style={propertyTitleStyle}>{propertyTitle}</strong> ha sido revisada 
            por nuestro equipo de moderación y requiere algunas <strong>correcciones</strong> antes 
            de ser publicada.
          </Text>

          <Section style={rejectionBox}>
            <Text style={rejectionTitle}>📋 Motivo del rechazo</Text>
            <Text style={rejectionLabel}>{rejectionReason.label}</Text>
            {rejectionReason.details && (
              <Text style={rejectionDetails}>{rejectionReason.details}</Text>
            )}
          </Section>

          <Section style={stepsBox}>
            <Text style={stepsTitle}>🔧 ¿Cómo corregir tu propiedad?</Text>
            <Text style={stepItem}><strong>1.</strong> Accede a tu panel de agente</Text>
            <Text style={stepItem}><strong>2.</strong> Encuentra tu propiedad rechazada (marcada con ❌)</Text>
            <Text style={stepItem}><strong>3.</strong> Haz clic en "Editar" para corregir los problemas</Text>
            <Text style={stepItem}><strong>4.</strong> Revisa cuidadosamente cada punto mencionado</Text>
            <Text style={stepItem}><strong>5.</strong> Guarda los cambios y haz clic en "Reenviar"</Text>
          </Section>

          <Section style={warningBox}>
            <Text style={warningTitle}>⚠️ Importante</Text>
            <Text style={warningText}>
              Tienes hasta <strong>3 intentos de reenvío</strong> para esta propiedad. 
              Asegúrate de corregir todos los puntos mencionados antes de reenviarla para 
              agilizar el proceso de aprobación.
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Link
              href="https://kentramx.lovable.app/agente/dashboard"
              style={button}
            >
              Ir a mi Dashboard
            </Link>
          </Section>

          <Hr style={hr} />

          <Section style={helpBox}>
            <Text style={helpTitle}>💬 ¿Necesitas ayuda?</Text>
            <Text style={helpText}>
              Si tienes dudas sobre las correcciones o necesitas asistencia, nuestro equipo 
              está aquí para ayudarte. Contáctanos en cualquier momento.
            </Text>
          </Section>

          <Text style={signature}>
            Saludos,<br />
            <strong>Equipo de Moderación · Kentra MX</strong>
          </Text>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            <Link href="https://kentramx.lovable.app" style={footerLink}>
              Kentra MX
            </Link>
            {' · '}Tu plataforma inmobiliaria de confianza
          </Text>
          <Text style={footerText}>
            Soporte:{' '}
            <Link href="mailto:contact@kentra.com.mx" style={footerLink}>
              contact@kentra.com.mx
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default RejectedEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  padding: '40px 30px',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0',
  padding: '0',
};

const content = {
  padding: '40px 30px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#333333',
  margin: '16px 0',
};

const propertyTitleStyle = {
  color: '#f5576c',
};

const rejectionBox = {
  backgroundColor: '#fef2f2',
  border: '2px solid #ef4444',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '24px',
  marginBottom: '24px',
};

const rejectionTitle = {
  color: '#991b1b',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const rejectionLabel = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#dc2626',
  margin: '8px 0',
};

const rejectionDetails = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#7f1d1d',
  margin: '12px 0 0 0',
  paddingLeft: '12px',
  borderLeft: '3px solid #fca5a5',
};

const stepsBox = {
  backgroundColor: '#f0f9ff',
  border: '2px solid #3b82f6',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '24px',
  marginBottom: '24px',
};

const stepsTitle = {
  color: '#1e40af',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px 0',
};

const stepItem = {
  fontSize: '15px',
  lineHeight: '28px',
  color: '#1e3a8a',
  margin: '8px 0',
};

const warningBox = {
  backgroundColor: '#fffbeb',
  border: '2px solid #f59e0b',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '24px',
  marginBottom: '24px',
};

const warningTitle = {
  color: '#92400e',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const warningText = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#78350f',
  margin: '0',
};

const helpBox = {
  backgroundColor: '#f5f3ff',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '24px',
};

const helpTitle = {
  color: '#6b21a8',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 8px 0',
};

const helpText = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#581c87',
  margin: '0',
};

const ctaSection = {
  textAlign: 'center' as const,
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#667eea',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 40px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
};

const signature = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#333333',
  marginTop: '32px',
};

const footer = {
  backgroundColor: '#f6f9fc',
  padding: '24px 30px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#8898aa',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '8px 0',
};

const footerLink = {
  color: '#667eea',
  textDecoration: 'none',
};
