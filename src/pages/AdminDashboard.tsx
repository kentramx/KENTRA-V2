import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import QualityChecklist from '@/components/QualityChecklist';
import PropertyDiff from '@/components/PropertyDiff';
import AdminModerationMetrics from '@/components/AdminModerationMetrics';
import { AdminRoleManagement } from '@/components/AdminRoleManagement';
import { SuperAdminMetrics } from '@/components/SuperAdminMetrics';
import AIPreModerationBadge from '@/components/AIPreModerationBadge';
import AutoApprovalStats from '@/components/AutoApprovalStats';
import ImageQualityBadge from '@/components/ImageQualityBadge';
import ImageAnalysisDetails from '@/components/ImageAnalysisDetails';
import ImageAnalysisStats from '@/components/ImageAnalysisStats';

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
  const { isAdmin, isSuperAdmin, adminRole, loading: adminLoading } = useAdminCheck();
  
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  
  const [rejectProperty, setRejectProperty] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionDetails, setRejectionDetails] = useState('');
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

  useEffect(() => {
    if (isAdmin) {
      fetchProperties();
      fetchMetrics();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (!quickReviewMode || !viewProperty) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'a') {
        handleApprove(viewProperty);
      } else if (e.key === 'r') {
        setRejectProperty(viewProperty);
        setViewProperty(null);
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
          *,
          images (url, position),
          profiles!properties_agent_id_fkey (name, email)
        `)
        .eq('status', 'pendiente_aprobacion')
        .order('created_at', { ascending: false });

      if (activeTab === 'new') {
        query = query.eq('resubmission_count', 0);
      } else if (activeTab === 'resubmitted') {
        query = query.gt('resubmission_count', 0).order('resubmission_count', { ascending: false });
      } else if (activeTab === 'old') {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        query = query.lt('created_at', threeDaysAgo);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las propiedades',
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
          admin_notes: adminNotes || null,
        });

      if (historyError) throw historyError;

      // Enviar notificación por email al agente
      try {
        await supabase.functions.invoke('send-moderation-notification', {
          body: {
            agentEmail: property.profiles?.email,
            agentName: property.profiles?.name || 'Agente',
            propertyTitle: property.title,
            action: 'approved',
          },
        });
        console.log('Email notification sent successfully');
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
        description: 'No se pudo aprobar la propiedad',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectProperty || !rejectionReason) return;
    if (rejectionReason === 'other' && !rejectionDetails.trim()) {
      toast({
        title: 'Error',
        description: 'Debes especificar el motivo de rechazo',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const reasonLabel = REJECTION_REASONS.find(r => r.code === rejectionReason)?.label || '';
      const rejectionData = {
        code: rejectionReason,
        label: reasonLabel,
        details: rejectionDetails,
        admin_id: user?.id,
        rejected_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('properties')
        .update({
          status: 'pausada',
          rejection_reason: rejectionData,
        })
        .eq('id', rejectProperty.id);

      if (updateError) throw updateError;

      const { error: historyError } = await (supabase as any)
        .from('property_moderation_history')
        .insert({
          property_id: rejectProperty.id,
          agent_id: rejectProperty.agent_id,
          admin_id: user?.id,
          action: 'rejected',
          rejection_reason: rejectionData,
          admin_notes: adminNotes || null,
        });

      if (historyError) throw historyError;

      // Enviar notificación por email al agente
      try {
        await supabase.functions.invoke('send-moderation-notification', {
          body: {
            agentEmail: rejectProperty.profiles?.email,
            agentName: rejectProperty.profiles?.name || 'Agente',
            propertyTitle: rejectProperty.title,
            action: 'rejected',
            rejectionReason: rejectionData,
          },
        });
        console.log('Email notification sent successfully');
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // No fallar el rechazo si el email falla
      }

      toast({
        title: '❌ Rechazada',
        description: 'La propiedad ha sido rechazada y el agente ha sido notificado por email',
      });

      setRejectProperty(null);
      setRejectionReason('');
      setRejectionDetails('');
      setAdminNotes('');
      fetchProperties();
      fetchMetrics();
    } catch (error) {
      console.error('Error rejecting property:', error);
      toast({
        title: 'Error',
        description: 'No se pudo rechazar la propiedad',
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

        {/* Estadísticas de Auto-Aprobación Inteligente */}
        <div className="space-y-4 mb-6">
          <AutoApprovalStats />
          <ImageAnalysisStats />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="new">
              Nuevas ({metrics.new})
            </TabsTrigger>
            <TabsTrigger value="resubmitted">
              Reenviadas - Alta Prioridad ({metrics.resubmitted})
            </TabsTrigger>
            <TabsTrigger value="old">
              Antiguas ({metrics.old})
            </TabsTrigger>
            <TabsTrigger value="metrics">
              Métricas y Tendencias
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="kpis">
                KPIs de Negocio
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="roles">
                Gestión de Roles
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="new" className="space-y-4">
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
                                <AIPreModerationBadge 
                                  score={property.ai_moderation_score}
                                  status={property.ai_moderation_status}
                                  notes={property.ai_moderation_notes}
                                  moderatedAt={property.ai_moderated_at}
                                />
                                <ImageQualityBadge 
                                  averageQuality={property.images_quality_avg}
                                  analyzedCount={property.images_analyzed_count}
                                  hasInappropriate={property.has_inappropriate_images}
                                  hasManipulated={property.has_manipulated_images}
                                />
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
                            onClick={() => setRejectProperty(property)}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rechazar
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

          <TabsContent value="resubmitted" className="space-y-4">
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
                                <AIPreModerationBadge 
                                  score={property.ai_moderation_score}
                                  status={property.ai_moderation_status}
                                  notes={property.ai_moderation_notes}
                                  moderatedAt={property.ai_moderated_at}
                                />
                                <ImageQualityBadge 
                                  averageQuality={property.images_quality_avg}
                                  analyzedCount={property.images_analyzed_count}
                                  hasInappropriate={property.has_inappropriate_images}
                                  hasManipulated={property.has_manipulated_images}
                                />
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
                            onClick={() => setRejectProperty(property)}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rechazar
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

          <TabsContent value="old" className="space-y-4">
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
                                <AIPreModerationBadge 
                                  score={property.ai_moderation_score}
                                  status={property.ai_moderation_status}
                                  notes={property.ai_moderation_notes}
                                  moderatedAt={property.ai_moderated_at}
                                />
                                <ImageQualityBadge 
                                  averageQuality={property.images_quality_avg}
                                  analyzedCount={property.images_analyzed_count}
                                  hasInappropriate={property.has_inappropriate_images}
                                  hasManipulated={property.has_manipulated_images}
                                />
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
                            onClick={() => setRejectProperty(property)}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rechazar
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

          <TabsContent value="metrics">
            <AdminModerationMetrics />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="kpis">
              <SuperAdminMetrics />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="roles">
              <AdminRoleManagement 
                currentUserId={user?.id || ''} 
                isSuperAdmin={isSuperAdmin} 
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Dialog de vista detallada */}
      <Dialog open={!!viewProperty} onOpenChange={() => setViewProperty(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisión Detallada</DialogTitle>
          </DialogHeader>
          {viewProperty && (
            <div className="space-y-4">
              <QualityChecklist property={viewProperty} />
              
              {/* Análisis de Imágenes con IA */}
              <ImageAnalysisDetails propertyId={viewProperty.id} />
              
              {viewProperty.resubmission_count > 0 && (
                <PropertyDiff property={viewProperty} />
              )}

              <div className="space-y-2">
                <Label>Notas internas (opcional)</Label>
                <Textarea
                  placeholder="Notas para otros administradores..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="default"
                  onClick={() => handleApprove(viewProperty)}
                  disabled={processing}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Aprobar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setRejectProperty(viewProperty);
                    setViewProperty(null);
                  }}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Rechazar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Rechazo */}
      <Dialog open={!!rejectProperty} onOpenChange={() => setRejectProperty(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar Propiedad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta acción pausará la propiedad y notificará al agente
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Motivo del rechazo*</Label>
              <Select value={rejectionReason} onValueChange={setRejectionReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map((reason) => (
                    <SelectItem key={reason.code} value={reason.code}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Detalles adicionales{rejectionReason === 'other' && '*'}
              </Label>
              <Textarea
                value={rejectionDetails}
                onChange={(e) => setRejectionDetails(e.target.value)}
                placeholder="Explica al agente qué debe corregir..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas internas (opcional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Notas para otros administradores..."
                rows={2}
              />
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                El agente recibirá un email con este motivo y podrá corregir la propiedad para reenviarla (máximo 3 intentos).
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setRejectProperty(null)}
                disabled={processing}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={processing || !rejectionReason}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rechazando...
                  </>
                ) : (
                  'Confirmar Rechazo'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;