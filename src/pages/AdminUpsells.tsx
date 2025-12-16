import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';

interface Upsell {
  id: string;
  name: string;
  description: string;
  price: number;
  stripe_price_id: string;
  icon_name: string;
  badge: string | null;
  is_recurring: boolean;
  user_type: 'agent' | 'agency' | 'both';
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const ICON_OPTIONS = [
  'Plus', 'Star', 'Users', 'GraduationCap', 'LayoutTemplate', 'BarChart3',
  'Zap', 'Crown', 'Rocket', 'Target', 'TrendingUp', 'Award'
];

const AdminUpsells = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin, loading: adminLoading } = useAdminCheck();

  const [upsells, setUpsells] = useState<Upsell[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUpsell, setEditingUpsell] = useState<Upsell | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stripe_price_id: '',
    icon_name: 'Plus',
    badge: '',
    is_recurring: true,
    user_type: 'agent' as 'agent' | 'agency' | 'both',
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    if (!adminLoading && !isSuperAdmin) {
      toast({
        title: 'Acceso denegado',
        description: 'Solo super admins pueden acceder a esta página.',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [isSuperAdmin, adminLoading, navigate, toast]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUpsells();
    }
  }, [isSuperAdmin]);

  const fetchUpsells = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('upsells')
        .select('*')
        .order('user_type', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) throw error;
      setUpsells((data || []) as Upsell[]);
    } catch (error) {
      console.error('Error fetching upsells:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los upsells.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (upsell?: Upsell) => {
    if (upsell) {
      setEditingUpsell(upsell);
      setFormData({
        name: upsell.name,
        description: upsell.description,
        price: upsell.price.toString(),
        stripe_price_id: upsell.stripe_price_id,
        icon_name: upsell.icon_name,
        badge: upsell.badge || '',
        is_recurring: upsell.is_recurring,
        user_type: upsell.user_type,
        is_active: upsell.is_active,
        display_order: upsell.display_order,
      });
    } else {
      setEditingUpsell(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        stripe_price_id: '',
        icon_name: 'Plus',
        badge: '',
        is_recurring: true,
        user_type: 'agent',
        is_active: true,
        display_order: upsells.length + 1,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description || !formData.price || !formData.stripe_price_id) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa todos los campos obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const upsellData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        stripe_price_id: formData.stripe_price_id,
        icon_name: formData.icon_name,
        badge: formData.badge || null,
        is_recurring: formData.is_recurring,
        user_type: formData.user_type,
        is_active: formData.is_active,
        display_order: formData.display_order,
      };

      if (editingUpsell) {
        const { error } = await supabase
          .from('upsells')
          .update(upsellData)
          .eq('id', editingUpsell.id);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Upsell actualizado correctamente.',
        });
      } else {
        const { error } = await supabase
          .from('upsells')
          .insert([upsellData]);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Upsell creado correctamente.',
        });
      }

      setDialogOpen(false);
      fetchUpsells();
    } catch (error) {
      console.error('Error saving upsell:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el upsell.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este upsell?')) return;

    try {
      const { error } = await supabase
        .from('upsells')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Upsell eliminado correctamente.',
      });

      fetchUpsells();
    } catch (error) {
      console.error('Error deleting upsell:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el upsell.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (upsell: Upsell) => {
    try {
      const { error } = await supabase
        .from('upsells')
        .update({ is_active: !upsell.is_active })
        .eq('id', upsell.id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: `Upsell ${!upsell.is_active ? 'activado' : 'desactivado'} correctamente.`,
      });

      fetchUpsells();
    } catch (error) {
      console.error('Error toggling upsell:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado del upsell.',
        variant: 'destructive',
      });
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <DynamicBreadcrumbs
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Administración', href: '/admin/dashboard', active: false },
            { label: 'Gestión de Upsells', href: '', active: true },
          ]}
          className="mb-4"
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Gestión de Upsells</CardTitle>
                <CardDescription>
                  Administra los extras disponibles para agentes e inmobiliarias
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Upsell
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upsells.map((upsell) => (
                  <TableRow key={upsell.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{upsell.name}</p>
                        {upsell.badge && (
                          <Badge variant="secondary" className="mt-1">
                            {upsell.badge}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>${upsell.price.toLocaleString('es-MX')}</TableCell>
                    <TableCell>
                      <Badge variant={upsell.is_recurring ? 'default' : 'outline'}>
                        {upsell.is_recurring ? 'Recurrente' : 'Único'}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{upsell.user_type}</TableCell>
                    <TableCell>
                      <Switch
                        checked={upsell.is_active}
                        onCheckedChange={() => handleToggleActive(upsell)}
                      />
                    </TableCell>
                    <TableCell>{upsell.display_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(upsell)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(upsell.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Dialog para crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingUpsell ? 'Editar Upsell' : 'Nuevo Upsell'}
            </DialogTitle>
            <DialogDescription>
              Completa la información del upsell. Los campos marcados con * son obligatorios.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Slot Adicional de Propiedad"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el beneficio del upsell"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Precio (MXN) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="499"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="display_order">Orden</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stripe_price_id">Stripe Price ID *</Label>
              <Input
                id="stripe_price_id"
                value={formData.stripe_price_id}
                onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
                placeholder="price_xxxxxxxxxxxxx"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="icon_name">Icono</Label>
                <Select
                  value={formData.icon_name}
                  onValueChange={(value) => setFormData({ ...formData, icon_name: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="badge">Badge (opcional)</Label>
                <Input
                  id="badge"
                  value={formData.badge}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                  placeholder="Ej: Más Popular"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="user_type">Tipo de Usuario</Label>
                <Select
                  value={formData.user_type}
                  onValueChange={(value: 'agent' | 'agency' | 'both') => 
                    setFormData({ ...formData, user_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agente</SelectItem>
                    <SelectItem value="agency">Inmobiliaria</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 mt-8">
                <Switch
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, is_recurring: checked })
                  }
                />
                <Label htmlFor="is_recurring">Recurrente</Label>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUpsells;
