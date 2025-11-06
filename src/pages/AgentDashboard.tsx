import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PropertyForm from '@/components/PropertyForm';
import AgentPropertyList from '@/components/AgentPropertyList';
import { AgentAnalytics } from '@/components/AgentAnalytics';

const AgentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [editingProperty, setEditingProperty] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      checkAgentStatus();
    }
  }, [user, authLoading, navigate]);

  const checkAgentStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data.role !== 'agent') {
        toast({
          title: 'Acceso denegado',
          description: 'Solo los agentes pueden acceder a esta página',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error checking agent status:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handlePropertyCreated = () => {
    setActiveTab('list');
    setEditingProperty(null);
    toast({
      title: 'Éxito',
      description: 'Propiedad creada correctamente',
    });
  };

  const handlePropertyUpdated = () => {
    setActiveTab('list');
    setEditingProperty(null);
    toast({
      title: 'Éxito',
      description: 'Propiedad actualizada correctamente',
    });
  };

  const handleEditProperty = (property: any) => {
    setEditingProperty(property);
    setActiveTab('form');
  };

  const handleNewProperty = () => {
    setEditingProperty(null);
    setActiveTab('form');
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile || profile.role !== 'agent') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Panel de Agente
          </h1>
          <p className="text-muted-foreground">
            Gestiona tus propiedades en venta o renta
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {activeTab === 'analytics' ? 'Panel de Analíticas' : 'Mis Propiedades'}
              </CardTitle>
              {activeTab === 'list' && (
                <Button onClick={handleNewProperty}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Propiedad
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="list">Mis Propiedades</TabsTrigger>
                <TabsTrigger value="analytics">Analíticas</TabsTrigger>
                <TabsTrigger value="form">
                  {editingProperty ? 'Editar' : 'Nueva'} Propiedad
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="mt-6">
                <AgentPropertyList onEdit={handleEditProperty} />
              </TabsContent>

              <TabsContent value="analytics" className="mt-6">
                <AgentAnalytics agentId={user?.id || ''} />
              </TabsContent>

              <TabsContent value="form" className="mt-6">
                <PropertyForm
                  property={editingProperty}
                  onSuccess={editingProperty ? handlePropertyUpdated : handlePropertyCreated}
                  onCancel={() => {
                    setActiveTab('list');
                    setEditingProperty(null);
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AgentDashboard;
