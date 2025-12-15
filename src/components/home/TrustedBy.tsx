import { Shield, Award, Clock, ThumbsUp } from 'lucide-react';

const TrustedBy = () => {
  const trustIndicators = [
    { icon: Shield, text: 'Pagos Seguros' },
    { icon: Award, text: 'Agentes Verificados' },
    { icon: Clock, text: 'Soporte 24/7' },
    { icon: ThumbsUp, text: 'Satisfacción Garantizada' },
  ];

  return (
    <section className="py-8 border-y border-border bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {trustIndicators.map((item) => (
            <div 
              key={item.text} 
              className="flex items-center gap-2 text-muted-foreground"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustedBy;
