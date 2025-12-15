import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  AlertTriangle,
  DollarSign,
  Settings,
  List,
  Palette
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateDiscountPercent, formatPrice } from '@/hooks/usePricingPlans';

const AVAILABLE_ICONS = [
  'building', 'star', 'users', 'folder', 'headphones', 'mail',
  'bar-chart', 'share', 'file-text', 'infinity', 'check', 'zap',
  'shield', 'clock', 'globe', 'target', 'award', 'trending-up',
  'user-check', 'home', 'key', 'camera', 'heart'
];

interface FeatureItem {
  text: string;
  icon: string;
  highlight: boolean;
}

interface PlanFeatures {
  limits?: {
    max_properties?: number;
    featured_per_month?: number;
    max_agents?: number | null;
    max_projects?: number | null;
  };
  capabilities?: Record<string, boolean>;
  display?: {
    badge?: string | null;
    highlight?: boolean;
    cta_text?: string;
    short_description?: string;
  };
  feature_list?: FeatureItem[];
  [key: string]: unknown;
}

interface EditPlanDialogProps {
  plan: {
    id: string;
    name: string;
    display_name: string;
    price_monthly: number;
    price_yearly: number | null;
    stripe_price_id_monthly: string | null;
    stripe_price_id_yearly: string | null;
    features: PlanFeatures;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditPlanDialog({ plan, open, onOpenChange, onSuccess }: EditPlanDialogProps) {
  const [saving, setSaving] = useState(false);
  
  // Basic info
  const [displayName, setDisplayName] = useState(plan.display_name);
  const [priceMonthly, setPriceMonthly] = useState(plan.price_monthly);
  const [priceYearly, setPriceYearly] = useState(plan.price_yearly || 0);
  
  // Stripe IDs
  const [stripePriceIdMonthly, setStripePriceIdMonthly] = useState(plan.stripe_price_id_monthly || '');
  const [stripePriceIdYearly, setStripePriceIdYearly] = useState(plan.stripe_price_id_yearly || '');
  
  // Limits
  const [maxProperties, setMaxProperties] = useState(plan.features.limits?.max_properties || 0);
  const [featuredPerMonth, setFeaturedPerMonth] = useState(plan.features.limits?.featured_per_month || 0);
  const [maxAgents, setMaxAgents] = useState(plan.features.limits?.max_agents || 0);
  const [maxProjects, setMaxProjects] = useState(plan.features.limits?.max_projects || 0);
  
  // Capabilities
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>(
    plan.features.capabilities || {}
  );
  
  // Display options
  const [badge, setBadge] = useState(plan.features.display?.badge || '');
  const [highlight, setHighlight] = useState(plan.features.display?.highlight || false);
  const [ctaText, setCtaText] = useState(plan.features.display?.cta_text || '');
  const [shortDescription, setShortDescription] = useState(plan.features.display?.short_description || '');
  
  // Feature list
  const [featureList, setFeatureList] = useState<FeatureItem[]>(
    plan.features.feature_list || []
  );

  // Calculate discount
  const discount = priceYearly > 0 ? calculateDiscountPercent(priceMonthly, priceYearly) : 0;
  const monthlyEquivalent = priceYearly > 0 ? Math.round(priceYearly / 12) : 0;

  // Determine plan type
  const isAgencyPlan = plan.name.includes('inmobiliaria');
  const isDeveloperPlan = plan.name.includes('desarrolladora');

  const handleAddFeature = () => {
    setFeatureList([
      ...featureList,
      { text: '', icon: 'check', highlight: false }
    ]);
  };

  const handleRemoveFeature = (index: number) => {
    setFeatureList(featureList.filter((_, i) => i !== index));
  };

  const handleUpdateFeature = (index: number, updates: Partial<FeatureItem>) => {
    setFeatureList(featureList.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  const handleMoveFeature = (index: number, direction: 'up' | 'down') => {
    const newList = [...featureList];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newList.length) return;
    
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    setFeatureList(newList);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newFeatures = {
        limits: {
          max_properties: maxProperties,
          featured_per_month: featuredPerMonth,
          max_agents: isAgencyPlan ? maxAgents : null,
          max_projects: isDeveloperPlan ? maxProjects : null,
        },
        capabilities,
        display: {
          badge: badge || null,
          highlight,
          cta_text: ctaText,
          short_description: shortDescription,
        },
        feature_list: featureList.filter(f => f.text.trim() !== ''),
      };

      const { error } = await supabase
        .from('subscription_plans')
        .update({
          display_name: displayName,
          price_monthly: priceMonthly,
          price_yearly: priceYearly || null,
          stripe_price_id_monthly: stripePriceIdMonthly || null,
          stripe_price_id_yearly: stripePriceIdYearly || null,
          features: newFeatures as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plan.id);

      if (error) throw error;

      toast.success('Plan actualizado correctamente');
      onSuccess();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Error al actualizar el plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Plan: {plan.display_name}
            <Badge variant="outline" className="font-mono text-xs">
              {plan.name}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Modifica precios, límites y características del plan
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pricing" className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="pricing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Precios
            </TabsTrigger>
            <TabsTrigger value="limits" className="gap-2">
              <Settings className="h-4 w-4" />
              Límites
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <List className="h-4 w-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-2">
              <Palette className="h-4 w-4" />
              Display
            </TabsTrigger>
          </TabsList>

          {/* PRICING TAB */}
          <TabsContent value="pricing" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre del Plan</Label>
                <Input 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="opacity-50">
                <Label>Slug (no editable)</Label>
                <Input value={plan.name} disabled />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Precio Mensual (MXN)</Label>
                <Input 
                  type="number"
                  value={priceMonthly} 
                  onChange={(e) => setPriceMonthly(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Precio Anual (MXN)</Label>
                <Input 
                  type="number"
                  value={priceYearly} 
                  onChange={(e) => setPriceYearly(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Descuento Anual</Label>
                <div className="h-10 flex items-center gap-2">
                  <Badge variant={discount > 0 ? "default" : "secondary"} className={discount > 0 ? "bg-green-600" : ""}>
                    {discount}% de descuento
                  </Badge>
                </div>
              </div>
            </div>

            {priceYearly > 0 && (
              <p className="text-sm text-muted-foreground">
                Precio anual equivale a <strong>${formatPrice(monthlyEquivalent)}/mes</strong>
              </p>
            )}

            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Configuración de Stripe (Avanzado)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price ID Mensual</Label>
                  <Input 
                    value={stripePriceIdMonthly} 
                    onChange={(e) => setStripePriceIdMonthly(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="price_..."
                  />
                </div>
                <div>
                  <Label>Price ID Anual</Label>
                  <Input 
                    value={stripePriceIdYearly} 
                    onChange={(e) => setStripePriceIdYearly(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="price_..."
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Estos valores deben coincidir con los productos en Stripe Dashboard
              </p>
            </div>
          </TabsContent>

          {/* LIMITS TAB */}
          <TabsContent value="limits" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Máximo de Propiedades</Label>
                <Input 
                  type="number"
                  value={maxProperties} 
                  onChange={(e) => setMaxProperties(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usa -1 para ilimitado
                </p>
              </div>
              <div>
                <Label>Destacadas por Mes</Label>
                <Input 
                  type="number"
                  value={featuredPerMonth} 
                  onChange={(e) => setFeaturedPerMonth(Number(e.target.value))}
                />
              </div>
            </div>

            {isAgencyPlan && (
              <div>
                <Label>Máximo de Agentes</Label>
                <Input 
                  type="number"
                  value={maxAgents} 
                  onChange={(e) => setMaxAgents(Number(e.target.value))}
                />
              </div>
            )}

            {isDeveloperPlan && (
              <div>
                <Label>Máximo de Proyectos</Label>
                <Input 
                  type="number"
                  value={maxProjects} 
                  onChange={(e) => setMaxProjects(Number(e.target.value))}
                />
              </div>
            )}

            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-4">Capacidades del Plan</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'priority_support', label: 'Soporte Prioritario' },
                  { key: 'analytics', label: 'Analytics Avanzados' },
                  { key: 'autopublicacion', label: 'Autopublicación a Redes' },
                  { key: 'reportes_avanzados', label: 'Reportes Avanzados' },
                  { key: 'branding', label: 'Branding Personalizado' },
                  { key: 'ia_copys', label: 'Copys con IA' },
                  { key: 'asesor_dedicado', label: 'Asesor Dedicado' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={capabilities[key] || false}
                      onCheckedChange={(checked) => 
                        setCapabilities({ ...capabilities, [key]: !!checked })
                      }
                    />
                    <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* FEATURES TAB */}
          <TabsContent value="features" className="space-y-4 mt-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Estas son las características que se muestran en la página de pricing
              </p>
              <Button onClick={handleAddFeature} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Feature
              </Button>
            </div>

            <div className="space-y-3">
              {featureList.map((feature, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                >
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleMoveFeature(index, 'up')}
                      disabled={index === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleMoveFeature(index, 'down')}
                      disabled={index === featureList.length - 1}
                    >
                      ↓
                    </Button>
                  </div>

                  <Select
                    value={feature.icon}
                    onValueChange={(value) => handleUpdateFeature(index, { icon: value })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ICONS.map(icon => (
                        <SelectItem key={icon} value={icon}>
                          {icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={feature.text}
                    onChange={(e) => handleUpdateFeature(index, { text: e.target.value })}
                    placeholder="Texto de la característica"
                    className="flex-1"
                  />

                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={feature.highlight}
                      onCheckedChange={(checked) => 
                        handleUpdateFeature(index, { highlight: !!checked })
                      }
                    />
                    <Label className="text-xs">Destacar</Label>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFeature(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {featureList.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No hay features configuradas. Haz click en "Agregar Feature" para comenzar.
                </div>
              )}
            </div>
          </TabsContent>

          {/* DISPLAY TAB */}
          <TabsContent value="display" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Badge del Plan</Label>
                <Select value={badge} onValueChange={setBadge}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin badge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin badge</SelectItem>
                    <SelectItem value="popular">Popular</SelectItem>
                    <SelectItem value="recommended">Recomendado</SelectItem>
                    <SelectItem value="best_value">Mejor Valor</SelectItem>
                    <SelectItem value="new">Nuevo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="highlight"
                    checked={highlight}
                    onCheckedChange={(checked) => setHighlight(!!checked)}
                  />
                  <Label htmlFor="highlight">Destacar este plan (borde resaltado)</Label>
                </div>
              </div>
            </div>

            <div>
              <Label>Texto del Botón CTA</Label>
              <Input 
                value={ctaText} 
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Ej: Comenzar con Pro"
              />
            </div>

            <div>
              <Label>Descripción Corta</Label>
              <Textarea 
                value={shortDescription} 
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Ej: Ideal para agentes en crecimiento"
                rows={2}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
