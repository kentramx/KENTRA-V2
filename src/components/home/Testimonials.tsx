import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
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
    <section className="section-padding bg-background overflow-hidden">
      <div className="container mx-auto px-4">
        {/* TIER S: Section header */}
        <div className="text-center mb-12 md:mb-16">
          <div className="flex justify-center mb-3">
            <div className="decorative-line" />
          </div>
          <h2 className="heading-section mb-4">
            Lo que dicen nuestros usuarios
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Miles de agentes y compradores confían en Kentra para sus transacciones inmobiliarias
          </p>
        </div>

        {/* TIER S: Testimonial card */}
        <div className="relative max-w-4xl mx-auto">
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-card via-card to-muted/20 rounded-3xl overflow-hidden">
            {/* Decorative quote */}
            <div className="absolute top-8 left-8 md:top-12 md:left-12 opacity-10">
              <svg className="w-16 h-16 md:w-24 md:h-24 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
            </div>
            
            <CardContent className="relative p-8 md:p-12 lg:p-16">
              {/* Content */}
              <p className="text-xl md:text-2xl text-foreground leading-relaxed mb-10 font-medium min-h-[120px]">
                "{testimonials[currentIndex].content}"
              </p>

              {/* Author */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-4 border-primary/10 shadow-lg">
                    <AvatarImage src={testimonials[currentIndex].image} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                      {testimonials[currentIndex].name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-foreground text-lg">
                      {testimonials[currentIndex].name}
                    </div>
                    <div className="text-muted-foreground">
                      {testimonials[currentIndex].role}
                    </div>
                  </div>
                </div>

                {/* Stars */}
                <div className="flex gap-1">
                  {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-center items-center gap-6 mt-10">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={prev} 
              className="rounded-full h-12 w-12 border-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            {/* Dots */}
            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setCurrentIndex(i);
                  }}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i === currentIndex 
                      ? 'w-10 bg-primary' 
                      : 'w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>

            <Button 
              variant="outline" 
              size="icon" 
              onClick={next} 
              className="rounded-full h-12 w-12 border-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
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
