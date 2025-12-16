import { SEOHead } from "@/components/SEOHead";
import Navbar from "@/components/Navbar";

const Privacidad = () => {
  return (
    <>
      <SEOHead
        title="Política de Privacidad | Kentra"
        description="Conoce cómo Kentra protege y utiliza tu información personal. Política de privacidad completa para usuarios de nuestra plataforma inmobiliaria."
        canonical="/privacidad"
        noindex={false}
      />
      <Navbar />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <h1 className="text-4xl font-bold mb-2">Política de Privacidad</h1>
          <p className="text-muted-foreground mb-8">
            Última actualización: 16 de diciembre de 2024
          </p>

          <div className="prose prose-lg max-w-none space-y-8">
            {/* Introducción */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introducción</h2>
              <p className="text-muted-foreground leading-relaxed">
                En Kentra (kentra.com.mx), nos comprometemos a proteger tu privacidad y tus datos personales. 
                Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos tu 
                información cuando utilizas nuestra plataforma de bienes raíces.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Al utilizar nuestros servicios, aceptas las prácticas descritas en esta política. 
                Te recomendamos leerla detenidamente.
              </p>
            </section>

            {/* Información que recopilamos */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Información que Recopilamos</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">2.1 Información de cuenta</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Nombre completo</li>
                <li>Dirección de correo electrónico</li>
                <li>Número de teléfono</li>
                <li>Fotografía de perfil (opcional)</li>
                <li>Información profesional (para agentes e inmobiliarias)</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">2.2 Información de propiedades</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Direcciones y ubicaciones de propiedades publicadas</li>
                <li>Fotografías e imágenes de propiedades</li>
                <li>Características y descripciones de inmuebles</li>
                <li>Precios y condiciones de venta o renta</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">2.3 Información de uso</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Búsquedas realizadas en la plataforma</li>
                <li>Propiedades visitadas y guardadas en favoritos</li>
                <li>Interacciones con otros usuarios</li>
                <li>Datos de navegación y uso del sitio</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">2.4 Información técnica</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Dirección IP</li>
                <li>Tipo de navegador y dispositivo</li>
                <li>Sistema operativo</li>
                <li>Datos de ubicación (con tu consentimiento)</li>
              </ul>
            </section>

            {/* Cómo usamos la información */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Cómo Usamos tu Información</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Utilizamos la información recopilada para:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Proporcionar y mejorar nuestros servicios de búsqueda y publicación de propiedades</li>
                <li>Facilitar la comunicación entre compradores, vendedores y agentes</li>
                <li>Procesar pagos y suscripciones</li>
                <li>Enviar notificaciones relevantes sobre propiedades y servicios</li>
                <li>Personalizar tu experiencia en la plataforma</li>
                <li>Prevenir fraudes y garantizar la seguridad de la plataforma</li>
                <li>Cumplir con obligaciones legales</li>
                <li>Realizar análisis y mejoras del servicio</li>
              </ul>
            </section>

            {/* Compartir información */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Con Quién Compartimos tu Información</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Podemos compartir tu información con:
              </p>
              
              <h3 className="text-xl font-medium mt-6 mb-3">4.1 Otros usuarios de la plataforma</h3>
              <p className="text-muted-foreground leading-relaxed">
                Cuando publicas una propiedad o contactas a un agente, tu información de contacto 
                puede ser visible para facilitar la comunicación.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">4.2 Proveedores de servicios</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Google:</strong> Para servicios de mapas, autenticación y analíticas</li>
                <li><strong>Stripe:</strong> Para procesamiento seguro de pagos</li>
                <li><strong>Servicios de correo electrónico:</strong> Para envío de notificaciones</li>
                <li><strong>Servicios de almacenamiento:</strong> Para guardar imágenes y documentos</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">4.3 Autoridades</h3>
              <p className="text-muted-foreground leading-relaxed">
                Cuando sea requerido por ley o para proteger nuestros derechos legales.
              </p>
            </section>

            {/* Derechos ARCO */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Tus Derechos (ARCO)</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                De acuerdo con la Ley Federal de Protección de Datos Personales en Posesión de 
                los Particulares de México, tienes los siguientes derechos:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Acceso:</strong> Conocer qué datos personales tenemos sobre ti</li>
                <li><strong>Rectificación:</strong> Corregir datos inexactos o incompletos</li>
                <li><strong>Cancelación:</strong> Solicitar la eliminación de tus datos</li>
                <li><strong>Oposición:</strong> Oponerte al uso de tus datos para ciertos fines</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Para ejercer estos derechos, contáctanos a través de{" "}
                <a href="mailto:privacidad@kentra.com.mx" className="text-primary hover:underline">
                  privacidad@kentra.com.mx
                </a>
              </p>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Cookies y Tecnologías Similares</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Utilizamos cookies y tecnologías similares para:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Mantener tu sesión iniciada</li>
                <li>Recordar tus preferencias</li>
                <li>Analizar el uso de la plataforma</li>
                <li>Mostrar contenido personalizado</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Puedes configurar tu navegador para rechazar cookies, aunque esto puede afectar 
                algunas funcionalidades del sitio.
              </p>
            </section>

            {/* Seguridad */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Seguridad de tus Datos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Implementamos medidas de seguridad técnicas, administrativas y físicas para proteger 
                tu información personal contra acceso no autorizado, alteración, divulgación o 
                destrucción. Esto incluye encriptación de datos, acceso restringido y monitoreo 
                continuo de nuestros sistemas.
              </p>
            </section>

            {/* Retención */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Retención de Datos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Conservamos tu información personal mientras tu cuenta esté activa o según sea 
                necesario para proporcionarte servicios. También podemos retener cierta información 
                para cumplir con obligaciones legales, resolver disputas y hacer cumplir nuestros acuerdos.
              </p>
            </section>

            {/* Menores */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Menores de Edad</h2>
              <p className="text-muted-foreground leading-relaxed">
                Nuestros servicios no están dirigidos a menores de 18 años. No recopilamos 
                intencionalmente información de menores. Si descubrimos que hemos recopilado 
                información de un menor, la eliminaremos de inmediato.
              </p>
            </section>

            {/* Cambios */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Cambios a esta Política</h2>
              <p className="text-muted-foreground leading-relaxed">
                Podemos actualizar esta Política de Privacidad periódicamente. Te notificaremos 
                sobre cambios significativos publicando la nueva política en esta página y, 
                cuando sea apropiado, enviándote una notificación por correo electrónico.
              </p>
            </section>

            {/* Contacto */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Contacto</h2>
              <p className="text-muted-foreground leading-relaxed">
                Si tienes preguntas sobre esta Política de Privacidad o sobre cómo manejamos 
                tus datos personales, puedes contactarnos:
              </p>
              <ul className="list-none mt-4 text-muted-foreground space-y-2">
                <li><strong>Correo electrónico:</strong>{" "}
                  <a href="mailto:privacidad@kentra.com.mx" className="text-primary hover:underline">
                    privacidad@kentra.com.mx
                  </a>
                </li>
                <li><strong>Sitio web:</strong>{" "}
                  <a href="https://kentra.com.mx" className="text-primary hover:underline">
                    kentra.com.mx
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </>
  );
};

export default Privacidad;
