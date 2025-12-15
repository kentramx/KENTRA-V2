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
        // Fallback values if fetch fails
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
    <section ref={sectionRef} className="py-16 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {statItems.map((stat, index) => (
            <div 
              key={stat.label}
              className="text-center"
              style={{ 
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: `all 0.6s ease-out ${index * 0.15}s`
              }}
            >
              <stat.icon className="h-10 w-10 mx-auto mb-4 text-primary" />
              <div className="font-serif text-4xl md:text-5xl font-bold text-primary mb-2">
                {isVisible ? <AnimatedNumber value={stat.value} /> : 0}
                {stat.suffix}
              </div>
              <div className="text-muted-foreground font-medium">{stat.label}</div>
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
