import Navbar from '@/components/Navbar';

const PricingDesarrolladora = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Planes para Desarrolladoras</h1>
          <p className="text-muted-foreground text-lg">
            Próximamente nueva información de precios y planes
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingDesarrolladora;
