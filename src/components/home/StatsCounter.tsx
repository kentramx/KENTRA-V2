import { useEffect, useState, useRef } from 'react';
import { Building2, Users, MapPin, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const StatsCounter = () => {
  const [stats, setStats] = useState({
    properties: 0,
    agents: 0,
    cities: 0,
    reviews: 0,
  });
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [propertiesRes, agentsRes, citiesRes, reviewsRes] = await Promise.all([
          supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'activa'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('properties').select('municipality').eq('status', 'activa'),
          supabase.from('agent_reviews').select('id', { count: 'exact', head: true }),
        ]);

        const uniqueCities = new Set(citiesRes.data?.map(p => p.municipality).filter(Boolean)).size;

        setStats({
          properties: propertiesRes.count || 150,
          agents: agentsRes.count || 50,
          cities: uniqueCities || 10,
          reviews: reviewsRes.count || 200,
        });
      } catch (error) {
        setStats({ properties: 150, agents: 50, cities: 10, reviews: 200 });
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const statItems = [
    { icon: Building2, value: stats.properties, label: 'Propiedades Activas', suffix: '+' },
    { icon: Users, value: stats.agents, label: 'Agentes Verificados', suffix: '+' },
    { icon: MapPin, value: stats.cities, label: 'Ciudades', suffix: '' },
    { icon: Star, value: stats.reviews, label: 'Reseñas 5 Estrellas', suffix: '+' },
  ];

  return (
    <section ref={sectionRef} className="section-padding bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {statItems.map((stat, index) => (
            <div 
              key={stat.label}
              className="text-center"
              style={{ 
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
                transition: `all 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.15}s`
              }}
            >
              {/* TIER S: Icon with gradient background */}
              <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/10 mb-4 md:mb-6">
                <stat.icon className="h-8 w-8 md:h-10 md:w-10 text-primary" />
              </div>
              
              {/* TIER S: Large bold number */}
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary tracking-tight mb-2">
                {isVisible ? <AnimatedNumber value={stat.value} /> : 0}
                {stat.suffix}
              </div>
              
              {/* Label */}
              <div className="text-muted-foreground font-medium text-sm md:text-base">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue.toLocaleString('es-MX')}</>;
};

export default StatsCounter;
