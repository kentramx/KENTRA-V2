import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Testimonial {
  id: number;
  name: string;
  role: string;
  image?: string;
  content: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "María González",
    role: "Agente Inmobiliario, CDMX",
    content: "Kentra transformó mi negocio. En 3 meses dupliqué mis leads y cerré más ventas que en todo el año anterior. La plataforma es intuitiva y profesional.",
    rating: 5,
  },
  {
    id: 2,
    name: "Carlos Mendoza",
    role: "Director, Inmobiliaria Premium GDL",
    content: "La mejor plataforma inmobiliaria de México. Nuestro equipo de 15 agentes gestiona todo desde un solo lugar. El soporte es excepcional.",
    rating: 5,
  },
  {
    id: 3,
    name: "Ana Rodríguez",
    role: "Compradora, Guadalajara",
    content: "Encontré mi departamento ideal en menos de 2 semanas. El filtro por mapa es increíble y los agentes respondieron muy rápido.",
    rating: 5,
  },
  {
    id: 4,
    name: "Roberto Sánchez",
    role: "Desarrollador Inmobiliario, Monterrey",
    content: "Publicamos todos nuestros desarrollos aquí. La visibilidad que nos da Kentra es incomparable. 100% recomendado.",
    rating: 5,
  },
];

const Testimonials = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const next = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((i) => (i + 1) % testimonials.length);
  };
  
  const prev = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((i) => (i - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
            Lo que dicen nuestros usuarios
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Miles de agentes y compradores confían en Kentra para sus transacciones inmobiliarias
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-card to-muted/30">
            <CardContent className="p-8 md:p-12">
              <Quote className="h-12 w-12 text-primary/20 mb-6" />
              
              <p className="text-xl md:text-2xl text-foreground leading-relaxed mb-8 min-h-[120px]">
                "{testimonials[currentIndex].content}"
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-primary/20">
                    <AvatarImage src={testimonials[currentIndex].image} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                      {testimonials[currentIndex].name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-foreground">
                      {testimonials[currentIndex].name}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {testimonials[currentIndex].role}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1">
                  {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-center items-center gap-4 mt-8">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={prev} 
              className="rounded-full h-10 w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setCurrentIndex(i);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>

            <Button 
              variant="outline" 
              size="icon" 
              onClick={next} 
              className="rounded-full h-10 w-10"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
