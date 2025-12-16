import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMonitoring } from '@/lib/monitoring';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Eye, Edit, Building2, Home, Filter, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DeveloperProjectManagementProps {
  developerId: string;
  subscriptionInfo: any;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  total_units: number;
  available_units: number;
  delivery_date: string | null;
  created_at: string;
  cover_image_url: string | null;
}

const PROJECT_STATUSES = [
  { value: 'planning', label: 'Planeación' },
  { value: 'construction', label: 'En Construcción' },
  { value: 'presale', label: 'Preventa' },
  { value: 'sale', label: 'En Venta' },
  { value: 'completed', label: 'Completado' },
];

export const DeveloperProjectManagement = ({ developerId, subscriptionInfo }: DeveloperProjectManagementProps) => {
  const { toast } = useToast();
  const { error: logError, warn, captureException } = useMonitoring();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    status: 'planning',
    total_units: 0,
    available_units: 0,
    delivery_date: '',
  });

  const maxProjects = subscriptionInfo?.features?.limits?.max_projects || 5;

  useEffect(() => {
    fetchProjects();
  }, [developerId]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('developer_projects')
        .select('*')
        .eq('developer_id', developerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      logError('Error fetching developer projects', {
        component: 'DeveloperProjectManagement',
        developerId,
        error,
      });
      captureException(error as Error, {
        component: 'DeveloperProjectManagement',
        action: 'fetchProjects',
        developerId,
      });
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los proyectos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    if (maxProjects !== -1 && projects.length >= maxProjects) {
      toast({
        title: 'Límite alcanzado',
        description: `Has alcanzado el límite de ${maxProjects} proyectos. Mejora tu plan para crear más.`,
        variant: 'destructive',
      });
      return;
    }
    setFormData({
      name: '',
      description: '',
      address: '',
      city: '',
      state: '',
      status: 'planning',
      total_units: 0,
      available_units: 0,
      delivery_date: '',
    });
    setEditingProject(null);
    setCreateDialogOpen(true);
  };

  const handleOpenEdit = (project: Project) => {
    setFormData({
      name: project.name,
      description: project.description || '',
      address: project.address || '',
      city: project.city || '',
      state: project.state || '',
      status: project.status,
      total_units: project.total_units,
      available_units: project.available_units,
      delivery_date: project.delivery_date || '',
    });
    setEditingProject(project);
    setCreateDialogOpen(true);
  };

  const handleSaveProject = async () => {
    if (!formData.name) {
      toast({
        title: 'Nombre requerido',
        description: 'Por favor ingresa un nombre para el proyecto',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingProject) {
        // Update existing
        const { error } = await supabase
          .from('developer_projects')
          .update({
            name: formData.name,
            description: formData.description || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            status: formData.status,
            total_units: formData.total_units,
            available_units: formData.available_units,
            delivery_date: formData.delivery_date || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProject.id);

        if (error) throw error;

        toast({
          title: '✅ Proyecto actualizado',
          description: 'Los cambios han sido guardados',
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('developer_projects')
          .insert({
            developer_id: developerId,
            name: formData.name,
            description: formData.description || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            status: formData.status,
            total_units: formData.total_units,
            available_units: formData.available_units,
            delivery_date: formData.delivery_date || null,
          });

        if (error) throw error;

        toast({
          title: '✅ Proyecto creado',
          description: 'El proyecto ha sido creado exitosamente',
        });
      }

      setCreateDialogOpen(false);
      setEditingProject(null);
      fetchProjects();
    } catch (error: any) {
      logError('Error saving project', {
        component: 'DeveloperProjectManagement',
        developerId,
        error,
      });
      captureException(error, {
        component: 'DeveloperProjectManagement',
        action: 'saveProject',
        developerId,
      });
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el proyecto',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = PROJECT_STATUSES.find(s => s.value === status);
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      planning: 'secondary',
      construction: 'outline',
      presale: 'default',
      sale: 'default',
      completed: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const filteredProjects = projects.filter((project) => {
    if (filterStatus !== 'all' && project.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: projects.length,
    planning: projects.filter(p => p.status === 'planning').length,
    construction: projects.filter(p => p.status === 'construction').length,
    presale: projects.filter(p => p.status === 'presale').length,
    sale: projects.filter(p => p.status === 'sale').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalUnits: projects.reduce((acc, p) => acc + (p.total_units || 0), 0),
    availableUnits: projects.reduce((acc, p) => acc + (p.available_units || 0), 0),
  };

  const canAddMore = maxProjects === -1 || projects.length < maxProjects;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Proyectos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">
              de {maxProjects === -1 ? '∞' : maxProjects} permitidos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En Preventa/Venta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{stats.presale + stats.sale}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unidades Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalUnits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.availableUnits}</p>
          </CardContent>
        </Card>
      </div>

      {/* Header con botón de crear */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Proyectos de Desarrollo</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona tus desarrollos inmobiliarios
          </p>
        </div>
        <Button onClick={handleOpenCreate} disabled={!canAddMore}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Alerta si está cerca del límite */}
      {!canAddMore && maxProjects !== -1 && (
        <Alert>
          <AlertDescription>
            Has alcanzado el límite de proyectos de tu plan. Mejora tu plan para crear más proyectos.
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtrar por estado:</span>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {PROJECT_STATUSES.map(status => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de proyectos */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            {projects.length === 0 
              ? 'No tienes proyectos creados'
              : 'No hay proyectos que coincidan con los filtros'
            }
          </p>
          {projects.length === 0 && (
            <Button onClick={handleOpenCreate}>
              Crear primer proyecto
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {project.cover_image_url ? (
                        <img
                          src={project.cover_image_url}
                          alt={project.name}
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{project.name}</p>
                        {project.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.city || project.state ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {[project.city, project.state].filter(Boolean).join(', ')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(project.status)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">{project.available_units}</span>
                      <span className="text-muted-foreground"> / {project.total_units}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.delivery_date
                      ? new Date(project.delivery_date).toLocaleDateString('es-MX', {
                          month: 'short',
                          year: 'numeric'
                        })
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(project)}
                        title="Editar proyecto"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog de crear/editar */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
            </DialogTitle>
            <DialogDescription>
              {editingProject 
                ? 'Modifica los datos de tu desarrollo inmobiliario'
                : 'Crea un nuevo desarrollo inmobiliario'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Proyecto *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Torre Residencial Chapultepec"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el desarrollo..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Ej: Guadalajara"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="Ej: Jalisco"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Dirección completa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado del Proyecto</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_units">Unidades Totales</Label>
                <Input
                  id="total_units"
                  type="number"
                  min="0"
                  value={formData.total_units}
                  onChange={(e) => setFormData({ ...formData, total_units: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="available_units">Disponibles</Label>
                <Input
                  id="available_units"
                  type="number"
                  min="0"
                  value={formData.available_units}
                  onChange={(e) => setFormData({ ...formData, available_units: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_date">Fecha de Entrega</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProject}
              disabled={saving || !formData.name}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingProject ? 'Guardar Cambios' : 'Crear Proyecto'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
