import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriceInput } from '../shared/PriceInput';
import { PropertyTypeSelector } from '../shared/PropertyTypeSelector';
import { PropertyFormData } from '@/hooks/useFormWizard';
import { InfoIcon } from 'lucide-react';

interface Step1BasicInfoProps {
  formData: PropertyFormData;
  updateFormData: (data: Partial<PropertyFormData>) => void;
}

export const Step1BasicInfo = ({ formData, updateFormData }: Step1BasicInfoProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Información Básica</h2>
        <p className="text-muted-foreground">
          Comencemos con los detalles principales de tu propiedad
        </p>
      </div>

      {/* Selector de Moneda */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Moneda
            </Label>
            <Select 
              value={formData.currency} 
              onValueChange={(value: 'MXN' | 'USD') => updateFormData({ currency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN - Pesos Mexicanos</SelectItem>
                <SelectItem value="USD">USD - Dólares Americanos</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Todos los precios se mostrarán en esta moneda
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Opciones de Listado */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label className="text-base font-semibold mb-3 block">
              ¿Qué deseas hacer con tu propiedad?
            </Label>
            <p className="text-sm text-muted-foreground mb-4">
              Puedes seleccionar ambas opciones si aplica
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Card 
              className={formData.for_sale ? "ring-2 ring-primary bg-primary/5" : ""}
              onClick={() => updateFormData({ for_sale: !formData.for_sale })}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={formData.for_sale}
                    onCheckedChange={(checked) => updateFormData({ for_sale: checked as boolean })}
                  />
                  <div className="space-y-1">
                    <Label className="text-base font-semibold cursor-pointer">
                      En Venta
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quiero vender esta propiedad
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={formData.for_rent ? "ring-2 ring-primary bg-primary/5" : ""}
              onClick={() => updateFormData({ for_rent: !formData.for_rent })}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={formData.for_rent}
                    onCheckedChange={(checked) => updateFormData({ for_rent: checked as boolean })}
                  />
                  <div className="space-y-1">
                    <Label className="text-base font-semibold cursor-pointer">
                      En Renta
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quiero rentar esta propiedad
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {!formData.for_sale && !formData.for_rent && (
            <Alert variant="destructive">
              <InfoIcon className="w-4 h-4" />
              <AlertDescription>
                Debes seleccionar al menos una opción
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Precios */}
      <div className="grid gap-6">
        {formData.for_sale && (
          <Card>
            <CardContent className="pt-6">
              <PriceInput
                label={`Precio de Venta (${formData.currency})`}
                value={formData.sale_price}
                onChange={(value) => updateFormData({ sale_price: value })}
                required
                placeholder="Ej: 2,500,000"
              />
            </CardContent>
          </Card>
        )}

        {formData.for_rent && (
          <Card>
            <CardContent className="pt-6">
              <PriceInput
                label={`Precio de Renta Mensual (${formData.currency})`}
                value={formData.rent_price}
                onChange={(value) => updateFormData({ rent_price: value })}
                required
                placeholder="Ej: 15,000"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tipo de Propiedad */}
      <Card>
        <CardContent className="pt-6">
          <PropertyTypeSelector
            value={formData.type}
            onChange={(type) => updateFormData({ type })}
          />
        </CardContent>
      </Card>
    </div>
  );
};
