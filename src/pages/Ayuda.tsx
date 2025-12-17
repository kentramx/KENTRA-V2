import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import Navbar from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, 
  Home, 
  Users, 
  CreditCard, 
  Settings, 
  MessageCircle,
  Mail,
  Phone,
  HelpCircle,
  Building2,
  FileText,
  Shield
} from "lucide-react";

interface FAQ {
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  faqs: FAQ[];
}

const faqCategories: FAQCategory[] = [
  {
    id: "compradores",
    title: "Para Compradores",
    description: "Buscar y contactar propiedades",
    icon: <Home className="h-5 w-5" />,
    faqs: [
      {
        question: "¿Cómo busco propiedades en Kentra?",
        answer: "Puedes buscar propiedades desde nuestra página principal o en la sección 'Buscar'. Usa los filtros por ubicación, tipo de propiedad, precio, número de recámaras y más para encontrar exactamente lo que necesitas."
      },
      {
        question: "¿Necesito crear una cuenta para ver propiedades?",
        answer: "No, puedes explorar todas las propiedades sin cuenta. Sin embargo, para guardar favoritos, contactar agentes por mensaje directo o recibir alertas de nuevas propiedades, necesitarás crear una cuenta gratuita."
      },
      {
        question: "¿Cómo contacto a un agente sobre una propiedad?",
        answer: "En cada propiedad encontrarás botones para contactar al agente por WhatsApp, llamada telefónica o mensaje directo dentro de la plataforma. También puedes visitar el perfil del agente para ver todas sus propiedades."
      },
      {
        question: "¿Cómo guardo propiedades favoritas?",
        answer: "Haz clic en el ícono de corazón en cualquier propiedad para guardarla. Puedes ver todas tus propiedades guardadas en la sección 'Favoritos' de tu perfil."
      },
      {
        question: "¿Puedo comparar propiedades?",
        answer: "Sí, puedes seleccionar hasta 4 propiedades para comparar lado a lado. Busca el botón 'Comparar' en las tarjetas de propiedades o en la vista de detalle."
      }
    ]
  },
  {
    id: "agentes",
    title: "Para Agentes",
    description: "Publicar y gestionar propiedades",
    icon: <Users className="h-5 w-5" />,
    faqs: [
      {
        question: "¿Cómo publico mi primera propiedad?",
        answer: "Regístrate como agente, elige un plan (puedes empezar con el trial gratuito de 14 días), y ve a 'Publicar Propiedad'. Completa el formulario con fotos, descripción y detalles. Tu propiedad será revisada y publicada en minutos."
      },
      {
        question: "¿Cuántas propiedades puedo publicar?",
        answer: "Depende de tu plan. El plan Básico permite 5 propiedades, el Profesional 20 propiedades, y el Premium propiedades ilimitadas. Puedes ver los detalles completos en nuestra página de precios."
      },
      {
        question: "¿Cómo edito o elimino una propiedad?",
        answer: "Ve a tu Panel de Agente, encuentra la propiedad en tu lista y haz clic en 'Editar' o 'Eliminar'. Puedes actualizar fotos, precio, descripción y todos los detalles en cualquier momento."
      },
      {
        question: "¿Cómo funciona la verificación de agente?",
        answer: "Para obtener la insignia de agente verificado, sube tu identificación oficial (INE) y documentos profesionales en la sección de verificación de tu perfil. El proceso toma 24-48 horas hábiles."
      },
      {
        question: "¿Puedo destacar mis propiedades?",
        answer: "Sí, según tu plan puedes destacar propiedades para que aparezcan primero en los resultados de búsqueda. Los planes superiores incluyen más destacados mensuales."
      }
    ]
  },
  {
    id: "pagos",
    title: "Pagos y Suscripciones",
    description: "Planes, facturación y métodos de pago",
    icon: <CreditCard className="h-5 w-5" />,
    faqs: [
      {
        question: "¿Qué métodos de pago aceptan?",
        answer: "Aceptamos tarjetas de crédito y débito (Visa, Mastercard, American Express). Todos los pagos se procesan de forma segura a través de Stripe."
      },
      {
        question: "¿Cómo cambio mi plan de suscripción?",
        answer: "Ve a tu Panel > Suscripción > 'Cambiar Plan'. Puedes subir o bajar de plan en cualquier momento. Al subir de plan, solo pagas la diferencia proporcional del período restante."
      },
      {
        question: "¿Cómo cancelo mi suscripción?",
        answer: "En tu Panel > Suscripción encontrarás la opción de cancelar. Tu plan seguirá activo hasta el final del período pagado. No hay penalizaciones por cancelar."
      },
      {
        question: "¿Ofrecen reembolsos?",
        answer: "Ofrecemos reembolso completo dentro de los primeros 7 días si no has publicado propiedades. Después de este período, puedes cancelar pero no habrá reembolso del período actual."
      },
      {
        question: "¿Cómo obtengo mi factura?",
        answer: "Las facturas se generan automáticamente y las puedes descargar desde tu Panel > Suscripción > 'Historial de Pagos'. Si necesitas factura con RFC específico, contáctanos."
      },
      {
        question: "¿Hay descuentos por pago anual?",
        answer: "Sí, al pagar anualmente obtienes 2 meses gratis (16% de descuento). Puedes cambiar de mensual a anual en cualquier momento desde tu panel de suscripción."
      }
    ]
  },
  {
    id: "tecnico",
    title: "Soporte Técnico",
    description: "Problemas de cuenta y plataforma",
    icon: <Settings className="h-5 w-5" />,
    faqs: [
      {
        question: "¿Cómo cambio mi contraseña?",
        answer: "Ve a Configuración > Seguridad > 'Cambiar Contraseña'. También puedes usar la opción 'Olvidé mi contraseña' en la página de inicio de sesión para recibir un enlace de recuperación por email."
      },
      {
        question: "No recibo correos de Kentra",
        answer: "Revisa tu carpeta de spam o correo no deseado. Agrega soporte@kentra.com.mx a tus contactos. Si el problema persiste, verifica que tu email esté correctamente escrito en tu perfil."
      },
      {
        question: "¿Cómo elimino mi cuenta?",
        answer: "Ve a Configuración > Cuenta > 'Eliminar Cuenta'. Ten en cuenta que esta acción es irreversible y se eliminarán todas tus propiedades, mensajes y datos asociados."
      },
      {
        question: "La página no carga correctamente",
        answer: "Intenta limpiar la caché de tu navegador (Ctrl+Shift+Delete), actualiza la página (F5), o prueba con otro navegador. Si el problema continúa, contáctanos con detalles del error."
      },
      {
        question: "¿En qué dispositivos puedo usar Kentra?",
        answer: "Kentra funciona en cualquier dispositivo con navegador web moderno: computadoras, tablets y celulares. Recomendamos Chrome, Firefox, Safari o Edge actualizados."
      }
    ]
  },
  {
    id: "inmobiliarias",
    title: "Inmobiliarias y Desarrolladoras",
    description: "Equipos y gestión empresarial",
    icon: <Building2 className="h-5 w-5" />,
    faqs: [
      {
        question: "¿Cómo registro mi inmobiliaria?",
        answer: "Selecciona 'Inmobiliaria' al registrarte y completa los datos de tu empresa. Luego podrás invitar a tus agentes para que se unan a tu equipo y gestionar sus propiedades de forma centralizada."
      },
      {
        question: "¿Cómo invito agentes a mi equipo?",
        answer: "En tu Panel de Inmobiliaria > Equipo > 'Invitar Agente'. Envía invitaciones por email y los agentes podrán unirse a tu organización manteniendo sus propiedades."
      },
      {
        question: "¿Puedo ver estadísticas de mi equipo?",
        answer: "Sí, el panel de inmobiliaria incluye métricas consolidadas de todas las propiedades y agentes de tu equipo: vistas, contactos, propiedades activas y más."
      },
      {
        question: "¿Qué beneficios tiene el plan Desarrolladora?",
        answer: "El plan Desarrolladora está diseñado para proyectos inmobiliarios con múltiples unidades. Incluye páginas de proyecto, inventario de unidades, y herramientas específicas para preventa."
      }
    ]
  }
];

const Ayuda = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter FAQs based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return faqCategories;
    
    const query = searchQuery.toLowerCase();
    return faqCategories.map(category => ({
      ...category,
      faqs: category.faqs.filter(
        faq => 
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
      )
    })).filter(category => category.faqs.length > 0);
  }, [searchQuery]);

  const displayedCategories = selectedCategory 
    ? filteredCategories.filter(c => c.id === selectedCategory)
    : filteredCategories;

  return (
    <>
      <SEOHead
        title="Centro de Ayuda - Kentra"
        description="Encuentra respuestas a tus preguntas sobre Kentra. Guías para compradores, agentes, pagos y soporte técnico."
        canonical="/ayuda"
      />
      <Navbar />
      
      <main className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                Centro de Ayuda
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                ¿Cómo podemos ayudarte hoy?
              </p>
              
              {/* Search Bar */}
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar en preguntas frecuentes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Category Cards */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-8">
              {faqCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(
                    selectedCategory === category.id ? null : category.id
                  )}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedCategory === category.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className={`mb-2 ${
                    selectedCategory === category.id ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {category.icon}
                  </div>
                  <h3 className="font-medium text-sm md:text-base">{category.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 hidden md:block">
                    {category.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Clear filter button */}
            {(selectedCategory || searchQuery) && (
              <div className="flex items-center gap-2 mb-6">
                {selectedCategory && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                  >
                    Limpiar categoría
                  </Button>
                )}
                {searchQuery && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSearchQuery("")}
                  >
                    Limpiar búsqueda
                  </Button>
                )}
              </div>
            )}

            {/* FAQ Accordions */}
            {displayedCategories.length === 0 ? (
              <Card className="max-w-2xl mx-auto">
                <CardContent className="py-12 text-center">
                  <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">
                    No encontramos resultados
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Intenta con otros términos o contacta a nuestro equipo de soporte.
                  </p>
                  <Button asChild>
                    <a href="mailto:soporte@kentra.com.mx">
                      Contactar Soporte
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {displayedCategories.map((category) => (
                  <div key={category.id}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-primary">{category.icon}</span>
                      <h2 className="text-xl font-semibold">{category.title}</h2>
                      <span className="text-sm text-muted-foreground">
                        ({category.faqs.length} preguntas)
                      </span>
                    </div>
                    <Accordion type="single" collapsible className="space-y-2">
                      {category.faqs.map((faq, index) => (
                        <AccordionItem 
                          key={index} 
                          value={`${category.id}-${index}`}
                          className="border rounded-lg px-4"
                        >
                          <AccordionTrigger className="text-left hover:no-underline py-4">
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground pb-4">
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
                ¿No encontraste lo que buscabas?
              </h2>
              
              <div className="grid md:grid-cols-3 gap-6">
                {/* Email */}
                <Card>
                  <CardHeader className="text-center">
                    <Mail className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <CardTitle className="text-lg">Email</CardTitle>
                    <CardDescription>
                      Respuesta en 24-48 horas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <Button variant="outline" asChild className="w-full">
                      <a href="mailto:soporte@kentra.com.mx">
                        soporte@kentra.com.mx
                      </a>
                    </Button>
                  </CardContent>
                </Card>

                {/* WhatsApp */}
                <Card>
                  <CardHeader className="text-center">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <CardTitle className="text-lg">WhatsApp</CardTitle>
                    <CardDescription>
                      Lun-Vie 9am-6pm
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <Button variant="outline" asChild className="w-full">
                      <a 
                        href="https://wa.me/5215512345678?text=Hola,%20necesito%20ayuda%20con%20Kentra"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Enviar mensaje
                      </a>
                    </Button>
                  </CardContent>
                </Card>

                {/* Chat IA */}
                <Card className="border-primary/50 bg-primary/5">
                  <CardHeader className="text-center">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <CardTitle className="text-lg">Chat IA</CardTitle>
                    <CardDescription>
                      Respuesta instantánea 24/7
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Usa el botón de chat en la esquina inferior derecha
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-xl font-semibold mb-6 text-center">
              Enlaces Útiles
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="outline" asChild>
                <Link to="/pricing-agente">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Ver Planes
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/terminos">
                  <FileText className="h-4 w-4 mr-2" />
                  Términos de Servicio
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/privacidad">
                  <Shield className="h-4 w-4 mr-2" />
                  Privacidad
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default Ayuda;
