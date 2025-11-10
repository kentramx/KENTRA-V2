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

interface ApprovedEmailProps {
  agentName: string;
  propertyTitle: string;
}

export const ApprovedEmail = ({
  agentName,
  propertyTitle,
}: ApprovedEmailProps) => (
  <Html>
    <Head />
    <Preview>¡Tu propiedad {propertyTitle} ha sido aprobada!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎉 ¡Felicidades {agentName}!</Heading>
        </Section>
        
        <Section style={content}>
          <Text style={paragraph}>
            Tu propiedad <strong style={propertyTitleStyle}>{propertyTitle}</strong> ha sido aprobada 
            y ya está <strong>visible públicamente</strong> en nuestra plataforma.
          </Text>

          <Section style={successBox}>
            <Text style={successTitle}>✅ ¿Qué significa esto?</Text>
            <Text style={listItem}>• Los usuarios podrán ver tu propiedad en búsquedas</Text>
            <Text style={listItem}>• Recibirás contactos directos de clientes interesados</Text>
            <Text style={listItem}>• Tus métricas de visualizaciones comenzarán a registrarse</Text>
            <Text style={listItem}>• La propiedad aparecerá en el directorio público</Text>
          </Section>

          <Section style={infoBox}>
            <Text style={infoTitle}>📅 Importante: Renovación Mensual</Text>
            <Text style={paragraph}>
              Debes renovar tu propiedad <strong>cada 30 días</strong> con un simple clic para mantenerla activa. 
              Si no se renueva, se pausará automáticamente, pero podrás reactivarla cuando lo necesites sin perder información.
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Link
              href="https://kentramx.lovable.app/agente/dashboard"
              style={button}
            >
              Ver mi Dashboard
            </Link>
          </Section>

          <Hr style={hr} />

          <Text style={paragraph}>
            Recuerda que puedes editar tu propiedad en cualquier momento desde tu panel de agente.
          </Text>

          <Text style={signature}>
            Saludos,<br />
            <strong>Equipo Kentra MX</strong>
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
            Si tienes alguna duda, contáctanos en{' '}
            <Link href="mailto:contact@kentra.com.mx" style={footerLink}>
              contact@kentra.com.mx
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default ApprovedEmail;

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
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
  color: '#667eea',
};

const successBox = {
  backgroundColor: '#f0fdf4',
  border: '2px solid #22c55e',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '24px',
  marginBottom: '24px',
};

const successTitle = {
  color: '#15803d',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const listItem = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#166534',
  margin: '8px 0',
};

const infoBox = {
  backgroundColor: '#eff6ff',
  border: '2px solid #3b82f6',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '24px',
  marginBottom: '24px',
};

const infoTitle = {
  color: '#1e40af',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 12px 0',
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
