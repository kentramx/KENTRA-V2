import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Coupon {
  id: string;
  code: string;
  stripe_coupon_id: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  currency: string;
  max_redemptions: number | null;
  times_redeemed: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  applies_to: string;
  campaign_name: string | null;
  created_at: string;
}

export function CouponManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewRedemptionsId, setViewRedemptionsId] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: '',
    max_redemptions: '',
    valid_until: '',
    applies_to: 'all',
    campaign_name: '',
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('promotion_coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons((data || []) as Coupon[]);
    } catch (error: any) {
      toast.error("Error al cargar cupones: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();

    const couponValue = formData.discount_type === 'percentage' 
      ? parseFloat(formData.discount_value)
      : Math.round(parseFloat(formData.discount_value) * 100); // Stripe usa centavos

    try {
      // Crear cupón en Stripe primero
      const { data: stripeData, error: stripeError } = await supabase.functions.invoke('create-stripe-coupon', {
        body: {
          code: formData.code.toUpperCase(),
          discount_type: formData.discount_type,
          discount_value: couponValue,
          max_redemptions: formData.max_redemptions ? parseInt(formData.max_redemptions) : null,
          valid_until: formData.valid_until || null,
        }
      });

      if (stripeError) throw stripeError;

      // Guardar en base de datos
      const { error: dbError } = await supabase
        .from('promotion_coupons')
        .insert({
          code: formData.code.toUpperCase(),
          stripe_coupon_id: stripeData.coupon_id,
          stripe_promotion_code_id: stripeData.promotion_code_id,
          discount_type: formData.discount_type,
          discount_value: formData.discount_type === 'percentage' ? couponValue : couponValue / 100,
          currency: 'mxn',
          max_redemptions: formData.max_redemptions ? parseInt(formData.max_redemptions) : null,
          valid_until: formData.valid_until || null,
          applies_to: formData.applies_to,
          campaign_name: formData.campaign_name || null,
        });

      if (dbError) throw dbError;

      toast.success("Cupón creado exitosamente");
      setIsDialogOpen(false);
      fetchCoupons();
      
      // Reset form
      setFormData({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        max_redemptions: '',
        valid_until: '',
        applies_to: 'all',
        campaign_name: '',
      });
    } catch (error: any) {
      toast.error("Error al crear cupón: " + error.message);
    }
  };

  const toggleCouponStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('promotion_coupons')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(currentStatus ? "Cupón desactivado" : "Cupón activado");
      fetchCoupons();
    } catch (error: any) {
      toast.error("Error al actualizar cupón: " + error.message);
    }
  };

  const viewRedemptions = async (couponId: string) => {
    try {
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select(`
          *,
          profiles:user_id(name, email),
          subscription_plans(display_name)
        `)
        .eq('coupon_id', couponId);

      if (error) throw error;
      setRedemptions(data || []);
      setViewRedemptionsId(couponId);
    } catch (error: any) {
      toast.error("Error al cargar canjes: " + error.message);
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado al portapapeles");
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Cargando cupones...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Cupones y Descuentos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona códigos promocionales para campañas de marketing
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Crear Cupón
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Cupón</DialogTitle>
              <DialogDescription>
                Crea un código promocional para aplicar descuentos
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código del Cupón *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="VERANO2024"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount_type">Tipo de Descuento *</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value: 'percentage' | 'fixed_amount') => 
                    setFormData({ ...formData, discount_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentaje</SelectItem>
                    <SelectItem value="fixed_amount">Monto Fijo (MXN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount_value">
                  Valor del Descuento * {formData.discount_type === 'percentage' ? '(%)' : '(MXN)'}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                  min="0"
                  max={formData.discount_type === 'percentage' ? '100' : undefined}
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  placeholder={formData.discount_type === 'percentage' ? '20' : '500'}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="applies_to">Aplica a</Label>
                <Select
                  value={formData.applies_to}
                  onValueChange={(value) => setFormData({ ...formData, applies_to: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Planes</SelectItem>
                    <SelectItem value="agent">Solo Agentes</SelectItem>
                    <SelectItem value="agency">Solo Inmobiliarias</SelectItem>
                    <SelectItem value="developer">Solo Desarrolladoras</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_redemptions">Límite de Usos (opcional)</Label>
                <Input
                  id="max_redemptions"
                  type="number"
                  min="1"
                  value={formData.max_redemptions}
                  onChange={(e) => setFormData({ ...formData, max_redemptions: e.target.value })}
                  placeholder="Ilimitado"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valid_until">Fecha de Expiración (opcional)</Label>
                <Input
                  id="valid_until"
                  type="datetime-local"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign_name">Nombre de Campaña (opcional)</Label>
                <Input
                  id="campaign_name"
                  value={formData.campaign_name}
                  onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                  placeholder="Promoción Verano 2024"
                />
              </div>

              <Button type="submit" className="w-full">
                Crear Cupón
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cupones Activos</CardTitle>
          <CardDescription>
            Total de cupones: {coupons.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descuento</TableHead>
                <TableHead>Aplica a</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono font-semibold">
                    {coupon.code}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                      onClick={() => copyCouponCode(coupon.code)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    {coupon.discount_type === 'percentage' 
                      ? `${coupon.discount_value}%`
                      : `$${coupon.discount_value} MXN`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {coupon.applies_to === 'all' ? 'Todos' : 
                       coupon.applies_to === 'agent' ? 'Agentes' :
                       coupon.applies_to === 'agency' ? 'Inmobiliarias' : 'Desarrolladoras'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {coupon.times_redeemed}
                    {coupon.max_redemptions && ` / ${coupon.max_redemptions}`}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={coupon.is_active}
                      onCheckedChange={() => toggleCouponStatus(coupon.id, coupon.is_active)}
                    />
                  </TableCell>
                  <TableCell>
                    {coupon.valid_until 
                      ? format(new Date(coupon.valid_until), 'dd MMM yyyy', { locale: es })
                      : 'Sin expiración'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewRedemptions(coupon.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Redemptions */}
      <Dialog open={!!viewRedemptionsId} onOpenChange={() => setViewRedemptionsId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Canjes del Cupón</DialogTitle>
            <DialogDescription>
              Total de canjes: {redemptions.length}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Descuento</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {redemptions.map((redemption) => (
                <TableRow key={redemption.id}>
                  <TableCell>
                    {redemption.profiles?.name || redemption.profiles?.email}
                  </TableCell>
                  <TableCell>
                    {redemption.subscription_plans?.display_name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    ${redemption.discount_amount} {redemption.currency.toUpperCase()}
                  </TableCell>
                  <TableCell>
                    {format(new Date(redemption.redeemed_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
