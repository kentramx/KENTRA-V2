import { SEOHead } from "@/components/SEOHead";
import Navbar from "@/components/Navbar";

const Terminos = () => {
  return (
    <>
      <SEOHead
        title="Términos de Servicio | Kentra"
        description="Términos y condiciones de uso de Kentra, la plataforma líder de bienes raíces en México. Conoce tus derechos y obligaciones como usuario."
        canonical="/terminos"
        noindex={false}
      />
      <Navbar />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <h1 className="text-4xl font-bold mb-2">Términos de Servicio</h1>
          <p className="text-muted-foreground mb-8">
            Última actualización: 16 de diciembre de 2024
          </p>

          <div className="prose prose-lg max-w-none space-y-8">
            {/* Aceptación */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Aceptación de los Términos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Al acceder y utilizar la plataforma Kentra (kentra.com.mx), aceptas estar 
                legalmente vinculado por estos Términos de Servicio. Si no estás de acuerdo 
                con alguno de estos términos, no debes utilizar nuestros servicios.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Nos reservamos el derecho de modificar estos términos en cualquier momento. 
                Los cambios entrarán en vigor inmediatamente después de su publicación en el sitio.
              </p>
            </section>

            {/* Descripción del servicio */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Descripción del Servicio</h2>
              <p className="text-muted-foreground leading-relaxed">
                Kentra es una plataforma en línea que conecta a compradores, vendedores, 
                arrendadores, arrendatarios y profesionales inmobiliarios. Nuestros servicios incluyen:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>Búsqueda de propiedades en venta y renta</li>
                <li>Publicación de listados de propiedades</li>
                <li>Conexión entre usuarios interesados y agentes inmobiliarios</li>
                <li>Herramientas de gestión para profesionales inmobiliarios</li>
                <li>Servicios de suscripción para agentes, inmobiliarias y desarrolladoras</li>
              </ul>
            </section>

            {/* Cuentas de usuario */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Cuentas de Usuario</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">3.1 Registro</h3>
              <p className="text-muted-foreground leading-relaxed">
                Para acceder a ciertas funciones, debes crear una cuenta proporcionando 
                información precisa y completa. Debes tener al menos 18 años para registrarte.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">3.2 Responsabilidad de la cuenta</h3>
              <p className="text-muted-foreground leading-relaxed">
                Eres responsable de mantener la confidencialidad de tu cuenta y contraseña, 
                así como de todas las actividades que ocurran bajo tu cuenta.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">3.3 Tipos de usuarios</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Compradores/Buscadores:</strong> Usuarios que buscan propiedades</li>
                <li><strong>Agentes:</strong> Profesionales inmobiliarios individuales</li>
                <li><strong>Inmobiliarias:</strong> Empresas de bienes raíces con equipos de agentes</li>
                <li><strong>Desarrolladoras:</strong> Empresas que desarrollan proyectos inmobiliarios</li>
              </ul>
            </section>

            {/* Uso aceptable */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Uso Aceptable</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">4.1 Conducta permitida</h3>
              <p className="text-muted-foreground leading-relaxed">
                Te comprometes a utilizar la plataforma de manera ética, legal y respetuosa 
                con otros usuarios.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">4.2 Conducta prohibida</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Está estrictamente prohibido:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Publicar información falsa o engañosa sobre propiedades</li>
                <li>Suplantar la identidad de otra persona o entidad</li>
                <li>Utilizar la plataforma para actividades fraudulentas</li>
                <li>Enviar spam o comunicaciones no solicitadas</li>
                <li>Publicar contenido ofensivo, ilegal o inapropiado</li>
                <li>Intentar acceder sin autorización a sistemas de Kentra</li>
                <li>Utilizar bots o scripts automatizados sin permiso</li>
                <li>Interferir con el funcionamiento normal de la plataforma</li>
              </ul>
            </section>

            {/* Publicación de propiedades */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Publicación de Propiedades</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">5.1 Veracidad de la información</h3>
              <p className="text-muted-foreground leading-relaxed">
                Al publicar una propiedad, garantizas que toda la información proporcionada 
                es precisa, actualizada y que tienes el derecho legal de publicarla.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">5.2 Contenido de los listados</h3>
              <p className="text-muted-foreground leading-relaxed">
                Las fotografías, descripciones y demás contenido de los listados deben ser 
                propios o contar con autorización para su uso. No se permite el uso de 
                imágenes engañosas o manipuladas.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">5.3 Moderación</h3>
              <p className="text-muted-foreground leading-relaxed">
                Kentra se reserva el derecho de revisar, editar o eliminar cualquier listado 
                que viole estos términos o nuestras políticas de contenido.
              </p>
            </section>

            {/* Planes y pagos */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Planes y Pagos</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">6.1 Suscripciones</h3>
              <p className="text-muted-foreground leading-relaxed">
                Ofrecemos diferentes planes de suscripción para profesionales inmobiliarios. 
                Los precios y características de cada plan están disponibles en nuestras 
                páginas de precios.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">6.2 Facturación</h3>
              <p className="text-muted-foreground leading-relaxed">
                Las suscripciones se facturan de forma recurrente (mensual o anual) según 
                el plan seleccionado. Al suscribirte, autorizas el cargo automático a tu 
                método de pago.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">6.3 Cancelación</h3>
              <p className="text-muted-foreground leading-relaxed">
                Puedes cancelar tu suscripción en cualquier momento. La cancelación será 
                efectiva al final del período de facturación actual. No se realizan 
                reembolsos prorrateados por cancelaciones anticipadas.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">6.4 Reembolsos</h3>
              <p className="text-muted-foreground leading-relaxed">
                Los reembolsos se evalúan caso por caso. Contáctanos si tienes algún 
                problema con tu suscripción o pago.
              </p>
            </section>

            {/* Propiedad intelectual */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Propiedad Intelectual</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">7.1 Contenido de Kentra</h3>
              <p className="text-muted-foreground leading-relaxed">
                Todos los derechos de propiedad intelectual de la plataforma, incluyendo 
                diseño, código, logotipos y marcas, pertenecen a Kentra.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">7.2 Tu contenido</h3>
              <p className="text-muted-foreground leading-relaxed">
                Conservas los derechos sobre el contenido que publicas. Sin embargo, al 
                publicar contenido en Kentra, nos otorgas una licencia no exclusiva, 
                mundial y libre de regalías para usar, mostrar, reproducir y distribuir 
                dicho contenido en relación con nuestros servicios.
              </p>
            </section>

            {/* Limitación de responsabilidad */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Limitación de Responsabilidad</h2>
              
              <h3 className="text-xl font-medium mt-6 mb-3">8.1 Servicio "tal cual"</h3>
              <p className="text-muted-foreground leading-relaxed">
                Kentra proporciona sus servicios "tal cual" y "según disponibilidad", 
                sin garantías de ningún tipo, expresas o implícitas.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">8.2 No somos parte de las transacciones</h3>
              <p className="text-muted-foreground leading-relaxed">
                Kentra es una plataforma de conexión. No somos parte de las transacciones 
                inmobiliarias entre usuarios. No garantizamos la exactitud de los listados, 
                la calidad de las propiedades, ni la conducta de los usuarios.
              </p>

              <h3 className="text-xl font-medium mt-6 mb-3">8.3 Límite de responsabilidad</h3>
              <p className="text-muted-foreground leading-relaxed">
                En la máxima medida permitida por la ley, Kentra no será responsable por 
                daños indirectos, incidentales, especiales o consecuentes que surjan del 
                uso de nuestros servicios.
              </p>
            </section>

            {/* Indemnización */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Indemnización</h2>
              <p className="text-muted-foreground leading-relaxed">
                Aceptas indemnizar y mantener indemne a Kentra, sus directivos, empleados 
                y agentes, de cualquier reclamación, daño, pérdida o gasto que surja de 
                tu uso de la plataforma o violación de estos términos.
              </p>
            </section>

            {/* Terminación */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Terminación</h2>
              <p className="text-muted-foreground leading-relaxed">
                Podemos suspender o terminar tu acceso a la plataforma en cualquier momento, 
                con o sin causa, con o sin previo aviso. En caso de terminación, las 
                disposiciones de estos términos que por su naturaleza deban sobrevivir, 
                continuarán vigentes.
              </p>
            </section>

            {/* Ley aplicable */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Ley Aplicable</h2>
              <p className="text-muted-foreground leading-relaxed">
                Estos Términos de Servicio se regirán e interpretarán de acuerdo con las 
                leyes de los Estados Unidos Mexicanos, sin consideración a sus disposiciones 
                sobre conflictos de leyes. Cualquier disputa será sometida a la jurisdicción 
                de los tribunales competentes de la Ciudad de México.
              </p>
            </section>

            {/* Disposiciones generales */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Disposiciones Generales</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Acuerdo completo:</strong> Estos términos constituyen el acuerdo 
                  completo entre tú y Kentra.
                </li>
                <li>
                  <strong>Divisibilidad:</strong> Si alguna disposición es inválida, las 
                  demás permanecerán en vigor.
                </li>
                <li>
                  <strong>Renuncia:</strong> La falta de ejercicio de un derecho no constituye 
                  renuncia al mismo.
                </li>
                <li>
                  <strong>Cesión:</strong> No puedes ceder estos términos sin nuestro 
                  consentimiento previo por escrito.
                </li>
              </ul>
            </section>

            {/* Contacto */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">13. Contacto</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para preguntas sobre estos Términos de Servicio, contáctanos:
              </p>
              <ul className="list-none mt-4 text-muted-foreground space-y-2">
                <li><strong>Correo electrónico:</strong>{" "}
                  <a href="mailto:soporte@kentra.com.mx" className="text-primary hover:underline">
                    soporte@kentra.com.mx
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

export default Terminos;
