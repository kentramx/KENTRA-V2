import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, XCircle, Eye, AlertTriangle, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import AdminModerationMetrics from '@/components/AdminModerationMetrics';

const REJECTION_REASONS = [
  { code: 'incomplete_info', label: 'Información incompleta' },
  { code: 'poor_images', label: 'Imágenes de baja calidad' },
  { code: 'wrong_price', label: 'Precio fuera de mercado' },
  { code: 'fake_listing', label: 'Publicación sospechosa/fraudulenta' },
  { code: 'duplicate', label: 'Propiedad duplicada' },
  { code: 'wrong_location', label: 'Ubicación incorrecta' },
  { code: 'missing_amenities', label: 'Faltan amenidades básicas' },
  { code: 'poor_description', label: 'Descripción inadecuada' },
  { code: 'other', label: 'Otro motivo (especificar)' },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, isSuperAdmin, adminRole, loading: adminLoading } = useAdminCheck();
  
  const [properties, setProperties] = useState<any[]>([]);
  const [approvedHistory, setApprovedHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Leer la pestaña activa de la URL (si existe) o usar 'nuevas' por defecto
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'nuevas');
  
  interface RejectionReasons {
    incompleteInfo: boolean;
    poorImages: boolean;
    incorrectLocation: boolean;
    suspiciousPrice: boolean;
    inappropriateContent: boolean;
    duplicateProperty: boolean;
    notes: string;
  }
  
  const [rejectionReasons, setRejectionReasons] = useState<RejectionReasons>({
    incompleteInfo: false,
    poorImages: false,
    incorrectLocation: false,
    suspiciousPrice: false,
    inappropriateContent: false,
    duplicateProperty: false,
    notes: ''
  });
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [viewProperty, setViewProperty] = useState<any>(null);
  const [quickReviewMode, setQuickReviewMode] = useState(false);
  
  const [metrics, setMetrics] = useState({
    new: 0,
    resubmitted: 0,
    old: 0,
    approved_today: 0,
    rejected_today: 0,
    avg_review_time: 0,
  });

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
      toast({
        title: 'Acceso denegado',
        description: 'No tienes permisos para acceder a esta página',
        variant: 'destructive',
      });
    }
  }, [isAdmin, adminLoading, navigate]);

  // Sincronizar activeTab con el parámetro tab de la URL (solo pestañas de moderación)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['nuevas', 'reenviadas', 'antiguas', 'historial', 'metricas'];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'historial') {
        fetchApprovedHistory();
      } else {
        fetchProperties();
        fetchMetrics();
      }
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (!quickReviewMode || !viewProperty) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'a') {
        handleApprove(viewProperty);
      } else if (e.key === 'ArrowRight') {
        goToNextProperty();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [quickReviewMode, viewProperty]);

  const goToNextProperty = () => {
    const currentIndex = properties.findIndex(p => p.id === viewProperty?.id);
    if (currentIndex < properties.length - 1) {
      setViewProperty(properties[currentIndex + 1]);
    }
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
    let query = (supabase as any)
      .from('properties')
      .select(`
        id, title, price, address, state, municipality, status,
        agent_id, ai_moderation_status, ai_moderation_score, created_at,
        resubmission_count, rejection_history,
        description, amenities, lat, lng,
        images (url, position),
        profiles!properties_agent_id_fkey (id, name)
      `, { count: 'exact' })
      .eq('status', 'pendiente_aprobacion')
      .lt('resubmission_count', 3); // Excluir propiedades que ya alcanzaron el límite

      if (activeTab === 'nuevas') {
        query = query.eq('resubmission_count', 0);
      } else if (activeTab === 'reenviadas') {
        query = query.gt('resubmission_count', 0).order('resubmission_count', { ascending: false });
      } else if (activeTab === 'antiguas') {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        query = query.lt('created_at', threeDaysAgo);
      } else if (activeTab === 'warnings') {
        query = query.eq('requires_manual_review', true);
      }

      // Add pagination limit - uses idx_properties_status_created
      query = query
        .order('created_at', { ascending: false })
        .limit(100); // Load first 100, implement pagination later

      const { data, error } = await query;
      if (error) throw error;
      setProperties(data || []);
  } catch (error: any) {
    console.error('Error fetching properties:', error);
    toast({
      title: 'Error',
      description: error?.message || 'No se pudieron cargar las propiedades',
      variant: 'destructive',
    });
  } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { count: newCount } = await (supabase as any)
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente_aprobacion')
        .eq('resubmission_count', 0);
      
      const { count: resubmittedCount } = await (supabase as any)
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente_aprobacion')
        .gt('resubmission_count', 0);
      
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { count: oldCount } = await (supabase as any)
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente_aprobacion')
        .lt('created_at', threeDaysAgo);
      
      const { count: approvedToday } = await (supabase as any)
        .from('property_moderation_history')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'approved')
        .gte('created_at', today);
      
      const { count: rejectedToday } = await (supabase as any)
        .from('property_moderation_history')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'rejected')
        .gte('created_at', today);
      
      const { data: avgTime } = await (supabase as any).rpc('get_avg_review_time_minutes');
      
      setMetrics({
        new: newCount || 0,
        resubmitted: resubmittedCount || 0,
        old: oldCount || 0,
        approved_today: approvedToday || 0,
        rejected_today: rejectedToday || 0,
        avg_review_time: Math.round((avgTime || 0) / 60), // Convert to hours
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchApprovedHistory = async () => {
    setLoading(true);
    try {
      // Traer propiedades activas con su historial de aprobación
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id, title, price, property_code, address, state, municipality, 
          created_at, updated_at, agent_id, type, listing_type,
          images (url, position),
          agent:profiles!properties_agent_id_fkey (id, name)
        `)
        .eq('status', 'activa')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Obtener historial de moderación para estas propiedades
      const propertyIds = data?.map(p => p.id) || [];
      
      if (propertyIds.length > 0) {
        const { data: historyData } = await supabase
          .from('property_moderation_history')
          .select('property_id, created_at, admin_id, action, notes')
          .in('property_id', propertyIds)
          .eq('action', 'approved')
          .order('created_at', { ascending: false });

        // Obtener nombres de los admins
        const adminIds = [...new Set(historyData?.map(h => h.admin_id).filter(Boolean) || [])];
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', adminIds);

        const adminMap = new Map(adminProfiles?.map(a => [a.id, a.name]) || []);

        // Combinar datos
        const propertiesWithHistory = data?.map(property => {
          const history = historyData?.find(h => h.property_id === property.id);
          return {
            ...property,
            approval_date: history?.created_at || property.updated_at,
            approved_by: history?.admin_id ? (adminMap.get(history.admin_id) || 'Admin') : 'Sistema',
            admin_notes: history?.notes,
          };
        });

        setApprovedHistory(propertiesWithHistory || []);
      } else {
        setApprovedHistory([]);
      }
    } catch (error: any) {
      console.error('Error fetching approved history:', error);
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo cargar el historial',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (property: any) => {
    setProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from('properties')
        .update({
          status: 'activa',
          last_renewed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', property.id);

      if (updateError) throw updateError;

      const { error: historyError } = await (supabase as any)
        .from('property_moderation_history')
        .insert({
          property_id: property.id,
          agent_id: property.agent_id,
          admin_id: user?.id,
          action: 'approved',
          notes: adminNotes || null,
        });

      if (historyError) throw historyError;

      // Enviar notificación por email al agente
      try {
        await supabase.functions.invoke('send-moderation-notification', {
          body: {
            agentId: property.agent_id,
            agentName: property.profiles?.name || 'Agente',
            propertyTitle: property.title,
            action: 'approved',
          },
        });
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // No fallar la aprobación si el email falla
      }

      toast({
        title: '✅ Aprobada',
        description: 'La propiedad ha sido aprobada y el agente ha sido notificado por email',
      });

      fetchProperties();
      fetchMetrics();
      setViewProperty(null);
      setAdminNotes('');
    } catch (error) {
      console.error('Error approving property:', error);
      toast({
        title: 'Error',
        description: (error as any)?.message || 'No se pudo aprobar la propiedad',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!viewProperty) return;

    // Validate that at least one reason is selected and notes are provided
    const hasSelectedReasons = Object.entries(rejectionReasons)
      .some(([key, value]) => key !== 'notes' && value === true);
    
    if (!hasSelectedReasons || !rejectionReasons.notes.trim()) {
      toast({
        title: "Error",
        description: "Selecciona al menos un motivo y agrega comentarios específicos para el agente",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      // Obtener datos actuales de la propiedad
      const { data: currentProperty } = await supabase
        .from('properties')
        .select('resubmission_count, rejection_history, title')
        .eq('id', viewProperty.id)
        .single();

      const currentResubmissions = currentProperty?.resubmission_count || 0;
      const currentHistory = currentProperty?.rejection_history || [];

      // Verificar límite de resubmisiones (máximo 3)
      if (currentResubmissions >= 3) {
        toast({
          title: "Límite alcanzado",
          description: "Esta propiedad ya ha sido rechazada 3 veces. No puede ser reenviada nuevamente.",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      // Format selected reasons as readable text
      const selectedReasonsList = Object.entries(rejectionReasons)
        .filter(([key, value]) => key !== 'notes' && value === true)
        .map(([key]) => {
          const reasonLabels: Record<string, string> = {
            incompleteInfo: 'Información incompleta',
            poorImages: 'Imágenes de baja calidad',
            incorrectLocation: 'Ubicación incorrecta',
            suspiciousPrice: 'Precio sospechoso',
            inappropriateContent: 'Contenido inapropiado',
            duplicateProperty: 'Propiedad duplicada'
          };
          return reasonLabels[key] || key;
        });

      const rejectionData = {
        reasons: selectedReasonsList,
        comments: rejectionReasons.notes,
        rejected_at: new Date().toISOString(),
        rejected_by: user?.id
      };

      // Crear registro del rechazo para el historial
      const rejectionRecord = {
        date: new Date().toISOString(),
        reasons: selectedReasonsList,
        comments: rejectionReasons.notes,
        reviewed_by: user?.email,
        resubmission_number: currentResubmissions + 1
      };

      // Actualizar historial (asegurarse de que sea un array)
      const historyArray = Array.isArray(currentHistory) ? currentHistory : [];
      const updatedHistory = [...historyArray, rejectionRecord];

      const { error: updateError } = await supabase
        .from('properties')
        .update({
          status: 'pausada',
          rejection_history: updatedHistory,
          resubmission_count: currentResubmissions + 1,
        })
        .eq('id', viewProperty.id);

      if (updateError) throw updateError;

      const { error: historyError } = await (supabase as any)
        .from('property_moderation_history')
        .insert({
          property_id: viewProperty.id,
          agent_id: viewProperty.agent_id,
          admin_id: user?.id,
          action: 'rejected',
          rejection_reason: rejectionData,
          notes: adminNotes || null,
        });

      if (historyError) throw historyError;

      // Enviar notificación por email al agente
      try {
        const rejectionMessage = `Motivos: ${selectedReasonsList.join(', ')}\n\nComentarios del moderador:\n${rejectionReasons.notes}`;
        
        await supabase.functions.invoke('send-moderation-notification', {
          body: {
            agentId: viewProperty.agent_id,
            agentName: viewProperty.profiles?.name || 'Agente',
            propertyTitle: viewProperty.title,
            action: 'rejected',
            rejectionReason: rejectionData,
          },
        });
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // No fallar el rechazo si el email falla
      }

      toast({
        title: '❌ Rechazada',
        description: 'La propiedad ha sido rechazada y el agente ha sido notificado',
        variant: 'destructive',
      });

      fetchProperties();
      fetchMetrics();
      setViewProperty(null);
      setRejectionReasons({
        incompleteInfo: false,
        poorImages: false,
        incorrectLocation: false,
        suspiciousPrice: false,
        inappropriateContent: false,
        duplicateProperty: false,
        notes: ''
      });
      setAdminNotes('');
    } catch (error) {
      console.error('Error rejecting property:', error);
      toast({
        title: 'Error',
        description: (error as any)?.message || 'No se pudo rechazar la propiedad',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Panel de Moderación</h1>
            {adminRole && (
              <p className="text-sm text-muted-foreground mt-1">
                Rol: <strong className="text-primary">{adminRole === 'super_admin' ? 'Super Admin' : adminRole === 'moderator' ? 'Moderador' : 'Admin'}</strong>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="quickReview"
              checked={quickReviewMode}
              onChange={(e) => setQuickReviewMode(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="quickReview" className="text-sm">
              Modo Rápido (A=Aprobar, R=Rechazar, →=Siguiente)
            </Label>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{metrics.new}</div>
              <p className="text-sm text-muted-foreground">Nuevas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{metrics.resubmitted}</div>
              <p className="text-sm text-muted-foreground">Reenviadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-600">{metrics.old}</div>
              <p className="text-sm text-muted-foreground">Antiguas (&gt;3 días)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{metrics.approved_today}</div>
              <p className="text-sm text-muted-foreground">Aprobadas hoy</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{metrics.rejected_today}</div>
              <p className="text-sm text-muted-foreground">Rechazadas hoy</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="nuevas">
              Nuevas ({metrics.new})
            </TabsTrigger>
            <TabsTrigger value="reenviadas">
              Reenviadas - Alta Prioridad ({metrics.resubmitted})
            </TabsTrigger>
            <TabsTrigger value="antiguas">
              Antiguas ({metrics.old})
            </TabsTrigger>
            <TabsTrigger value="historial">
              Historial de Aprobadas
            </TabsTrigger>
            <TabsTrigger value="metricas">
              Métricas y Tendencias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nuevas" className="space-y-4">
            {properties.length === 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay propiedades pendientes en esta categoría
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {properties.map((property) => (
                  <Card key={property.id}>
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        {property.images?.[0] && (
                          <img
                            src={property.images[0].url}
                            alt={property.title}
                            className="h-32 w-32 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg">{property.title}</h3>
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {(property as any).property_code || property.id.slice(0, 8)}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {property.municipality}, {property.state}
                              </p>
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <Badge variant="outline">{property.type}</Badge>
                                <Badge variant="outline">{property.listing_type}</Badge>
                                {property.resubmission_count > 0 && (
                                  <Badge variant="destructive">
                                    Reenvío #{property.resubmission_count}
                                  </Badge>
                                )}
                                {property.duplicate_warning && (
                                  <Badge variant="destructive" className="animate-pulse">
                                    ⚠️ POSIBLE DUPLICADO
                                  </Badge>
                                )}
                                {property.requires_manual_review && (
                                  <Badge variant="outline" className="border-orange-500 text-orange-700">
                                    Revisión Manual
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm mt-2">
                                <strong>Agente:</strong> {property.profiles?.name || 'N/A'}
                              </p>
                              <p className="text-sm">
                                <strong>Precio:</strong> {new Intl.NumberFormat('es-MX', {
                                  style: 'currency',
                                  currency: 'MXN',
                                }).format(property.price)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(property)}
                            disabled={processing}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setViewProperty(property)}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Revisar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewProperty(property)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalles
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reenviadas" className="space-y-4">
            {properties.length === 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay propiedades pendientes en esta categoría
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {properties.map((property) => (
                  <Card key={property.id}>
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        {property.images?.[0] && (
                          <img
                            src={property.images[0].url}
                            alt={property.title}
                            className="h-32 w-32 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg">{property.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {property.municipality}, {property.state}
                              </p>
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <Badge variant="outline">{property.type}</Badge>
                                <Badge variant="outline">{property.listing_type}</Badge>
                                {property.resubmission_count > 0 && (
                                  <Badge variant="destructive">
                                    Reenvío #{property.resubmission_count}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm mt-2">
                                <strong>Agente:</strong> {property.profiles?.name || 'N/A'}
                              </p>
                              <p className="text-sm">
                                <strong>Precio:</strong> {new Intl.NumberFormat('es-MX', {
                                  style: 'currency',
                                  currency: 'MXN',
                                }).format(property.price)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(property)}
                            disabled={processing}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setViewProperty(property)}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Revisar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewProperty(property)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalles
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="antiguas" className="space-y-4">
            {properties.length === 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay propiedades pendientes en esta categoría
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {properties.map((property) => (
                  <Card key={property.id}>
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        {property.images?.[0] && (
                          <img
                            src={property.images[0].url}
                            alt={property.title}
                            className="h-32 w-32 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg">{property.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {property.municipality}, {property.state}
                              </p>
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <Badge variant="outline">{property.type}</Badge>
                                <Badge variant="outline">{property.listing_type}</Badge>
                                {property.resubmission_count > 0 && (
                                  <Badge variant="destructive">
                                    Reenvío #{property.resubmission_count}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm mt-2">
                                <strong>Agente:</strong> {property.profiles?.name || 'N/A'}
                              </p>
                              <p className="text-sm">
                                <strong>Precio:</strong> {new Intl.NumberFormat('es-MX', {
                                  style: 'currency',
                                  currency: 'MXN',
                                }).format(property.price)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(property)}
                            disabled={processing}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setViewProperty(property)}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Revisar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewProperty(property)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalles
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historial" className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : approvedHistory.length === 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay propiedades aprobadas aún
                </AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium">Código</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Propiedad</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Precio</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Ubicación</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Agente</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Aprobado por</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Fecha de aprobación</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedHistory.map((property) => (
                        <tr key={property.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {property.property_code || property.id.slice(0, 8)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {property.images?.[0] && (
                                <img
                                  src={property.images[0].url}
                                  alt={property.title}
                                  className="h-12 w-12 rounded object-cover"
                                />
                              )}
                              <div className="max-w-[200px]">
                                <p className="font-medium text-sm truncate">{property.title}</p>
                                <div className="flex gap-1 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {property.type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-sm">
                              {new Intl.NumberFormat('es-MX', {
                                style: 'currency',
                                currency: 'MXN',
                                minimumFractionDigits: 0,
                              }).format(property.price)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-muted-foreground">
                              {property.municipality}, {property.state}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm">{property.agent?.name || 'N/A'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={property.approved_by === 'Sistema' ? 'outline' : 'default'} className="text-xs">
                              {property.approved_by}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-muted-foreground">
                              {new Date(property.approval_date).toLocaleDateString('es-MX', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {property.admin_notes ? (
                              <p className="text-xs text-muted-foreground max-w-[150px] truncate">
                                {property.admin_notes}
                              </p>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sin notas</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="metricas">
            <AdminModerationMetrics />
          </TabsContent>

          <TabsContent value="warnings" className="space-y-4">
            {properties.length === 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay propiedades con warnings pendientes
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {properties.map((property) => (
                  <Card key={property.id} className="border-orange-200 bg-orange-50/30">
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        {property.images?.[0] && (
                          <img
                            src={property.images[0].url}
                            alt={property.title}
                            className="h-32 w-32 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg">{property.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {property.municipality}, {property.state}
                              </p>
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <Badge variant="outline">{property.type}</Badge>
                                <Badge variant="outline">{property.listing_type}</Badge>
                                {property.duplicate_warning && (
                                  <Badge variant="destructive" className="animate-pulse">
                                    ⚠️ POSIBLE DUPLICADO
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm mt-2">
                                <strong>Agente:</strong> {property.profiles?.name || 'N/A'}
                              </p>
                              <p className="text-sm">
                                <strong>Precio:</strong> {new Intl.NumberFormat('es-MX', {
                                  style: 'currency',
                                  currency: 'MXN',
                                }).format(property.price)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(property)}
                            disabled={processing}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setViewProperty(property)}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Revisar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewProperty(property)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalles
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de Ver Detalles y Moderar */}
      <Dialog open={!!viewProperty} onOpenChange={() => {
        setViewProperty(null);
        setAdminNotes('');
        setRejectionReasons({
          incompleteInfo: false,
          poorImages: false,
          incorrectLocation: false,
          suspiciousPrice: false,
          inappropriateContent: false,
          duplicateProperty: false,
          notes: ''
        });
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar Propiedad: {viewProperty?.title}</DialogTitle>
          </DialogHeader>
          {viewProperty && (
            <div className="space-y-6">
              {/* Información de la Propiedad */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Información de la Propiedad</h3>
                
                {/* Imágenes */}
                {viewProperty.images && viewProperty.images.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Imágenes ({viewProperty.images.length})</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {viewProperty.images.slice(0, 6).map((image: any, index: number) => (
                        <img
                          key={index}
                          src={image.url}
                          alt={`${viewProperty.title} - ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Información básica */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Título</Label>
                    <p className="text-sm mt-1">{viewProperty.title}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Precio</Label>
                    <p className="text-sm mt-1 font-semibold text-primary">
                      {new Intl.NumberFormat('es-MX', {
                        style: 'currency',
                        currency: viewProperty.currency || 'MXN',
                      }).format(viewProperty.price)}
                    </p>
                  </div>
                </div>

                {/* Ubicación */}
                <div>
                  <Label className="text-sm font-medium">Ubicación</Label>
                  <p className="text-sm mt-1">
                    {viewProperty.address}
                    {viewProperty.colonia && `, ${viewProperty.colonia}`}
                    <br />
                    {viewProperty.municipality}, {viewProperty.state}
                  </p>
                </div>

                {/* Características */}
                <div className="grid grid-cols-4 gap-4">
                  {viewProperty.bedrooms && (
                    <div>
                      <Label className="text-sm font-medium">Recámaras</Label>
                      <p className="text-sm mt-1">{viewProperty.bedrooms}</p>
                    </div>
                  )}
                  {viewProperty.bathrooms && (
                    <div>
                      <Label className="text-sm font-medium">Baños</Label>
                      <p className="text-sm mt-1">{viewProperty.bathrooms}</p>
                    </div>
                  )}
                  {viewProperty.parking && (
                    <div>
                      <Label className="text-sm font-medium">Estacionamiento</Label>
                      <p className="text-sm mt-1">{viewProperty.parking}</p>
                    </div>
                  )}
                  {viewProperty.sqft && (
                    <div>
                      <Label className="text-sm font-medium">Superficie</Label>
                      <p className="text-sm mt-1">{viewProperty.sqft} m²</p>
                    </div>
                  )}
                </div>

                {/* Descripción */}
                {viewProperty.description && (
                  <div>
                    <Label className="text-sm font-medium">Descripción</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{viewProperty.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {viewProperty.description.trim().split(/\s+/).filter((word: string) => word.length > 0).length} palabras
                    </p>
                  </div>
                )}

                {/* Amenidades */}
                {viewProperty.amenities && Object.keys(viewProperty.amenities).length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Amenidades</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(viewProperty.amenities).map(([key, value]) => 
                        value && (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key.replace(/_/g, ' ')}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Agente */}
                <div>
                  <Label className="text-sm font-medium">Agente</Label>
                  <p className="text-sm mt-1">{viewProperty.profiles?.name || 'N/A'}</p>
                </div>
              </div>

              {/* Warning de duplicado */}
              {viewProperty?.duplicate_warning && viewProperty?.duplicate_warning_data && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle className="text-lg">⚠️ ADVERTENCIA: Posible Propiedad Duplicada</AlertTitle>
                  <AlertDescription>
                    <p className="mb-3 font-medium">
                      Sistema detectó {viewProperty.duplicate_warning_data.duplicate_count} propiedad{viewProperty.duplicate_warning_data.duplicate_count === 1 ? '' : 'es'} similar{viewProperty.duplicate_warning_data.duplicate_count === 1 ? '' : 'es'} en la misma zona:
                    </p>
                    
                    <div className="space-y-3 mb-4">
                      {viewProperty.duplicate_warning_data.similar_properties.map((dupProp: any) => (
                        <Card key={dupProp.id} className="bg-yellow-50 border-yellow-200">
                          <CardContent className="pt-4 pb-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold">{dupProp.title}</p>
                                <p className="text-sm text-muted-foreground">{dupProp.address}</p>
                              </div>
                              <Badge variant="outline">{dupProp.status}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-lg font-bold text-primary">
                                ${dupProp.price.toLocaleString('es-MX')}
                              </p>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(`/propiedad/${dupProp.id}`, '_blank')}
                              >
                                Ver Propiedad <Eye className="ml-2 h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertDescription className="text-sm text-blue-900">
                        <strong>👤 Acción requerida:</strong> Verifica manualmente si esta propiedad es realmente un duplicado de las listadas arriba. Si es duplicado, rechaza con motivo "Propiedad duplicada". Si es diferente, aprueba normalmente.
                      </AlertDescription>
                    </Alert>
                  </AlertDescription>
                </Alert>
              )}

              <Separator className="my-6" />

              {/* Sección de Motivos de Rechazo */}
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="font-semibold">Motivos de Rechazo</span>
                  <Badge variant="outline" className="ml-2">Requerido para rechazar</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {REJECTION_REASONS.map((reason) => (
                    <Label key={reason.code} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!rejectionReasons[reason.code as keyof RejectionReasons]}
                        onChange={(e) => setRejectionReasons(prev => ({
                          ...prev,
                          [reason.code]: e.target.checked
                        }))}
                        className="rounded"
                      />
                      {reason.label}
                    </Label>
                  ))}
                </div>
                
                <Textarea
                  placeholder="Notas adicionales sobre el rechazo..."
                  value={rejectionReasons.notes}
                  onChange={(e) => setRejectionReasons(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  rows={3}
                />
              </div>

              <Separator className="my-6" />

              {/* Notas internas del moderador */}
              <div className="space-y-2">
                <Label>Notas internas del moderador (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Estas notas solo son visibles para otros moderadores, no para el agente
                </p>
                <Textarea
                  placeholder="Notas para otros administradores..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="default"
                  onClick={() => handleApprove(viewProperty)}
                  disabled={processing}
                  className="min-w-[120px]"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Aprobar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={processing}
                  className="min-w-[120px]"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1" />
                  )}
                  Rechazar y Notificar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;