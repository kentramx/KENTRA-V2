import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMonitoring } from "@/lib/monitoring";

interface CouponInputProps {
  onCouponApplied: (couponCode: string | null) => void;
  planType?: 'agent' | 'agency' | 'developer';
}

export function CouponInput({ onCouponApplied, planType }: CouponInputProps) {
  const { error: logError, captureException } = useMonitoring();
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discountInfo, setDiscountInfo] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [shakeError, setShakeError] = useState(false);

  // Check if user is logged in
  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  });

  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Ingresa un código de cupón");
      triggerShake();
      return;
    }

    setIsValidating(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error("Debes iniciar sesión para aplicar cupones");
        triggerShake();
        return;
      }

      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: couponCode.toUpperCase(),
        p_user_id: user.user.id,
        p_plan_type: planType || null,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const validation = data[0];
        
        if (validation.is_valid) {
          setAppliedCoupon(couponCode.toUpperCase());
          setDiscountInfo(validation.message);
          onCouponApplied(couponCode.toUpperCase());
          toast.success("¡Cupón aplicado exitosamente!");
        } else {
          toast.error(validation.message);
          triggerShake();
        }
      }
    } catch (error: any) {
      logError('Error validating coupon', {
        component: 'CouponInput',
        couponCode,
        planType,
        error,
      });
      captureException(error, {
        component: 'CouponInput',
        action: 'validateCoupon',
        couponCode,
      });
      toast.error("Error al validar el cupón");
    } finally {
      setIsValidating(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setDiscountInfo(null);
    setCouponCode("");
    onCouponApplied(null);
    toast.info("Cupón removido");
  };

  if (appliedCoupon) {
    return (
      <div className="space-y-2">
        <Label>Cupón Aplicado</Label>
        <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <Tag className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <Badge variant="secondary" className="font-mono">
              {appliedCoupon}
            </Badge>
            {discountInfo && (
              <p className="text-sm text-muted-foreground mt-1">{discountInfo}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeCoupon}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // User not logged in - show disabled state
  if (isLoggedIn === false) {
    return (
      <div className="space-y-2">
        <Label htmlFor="coupon" className="text-muted-foreground">¿Tienes un cupón de descuento?</Label>
        <div className="flex gap-2">
          <Input
            id="coupon"
            disabled
            placeholder="Inicia sesión para usar cupones"
            className="font-mono bg-muted cursor-not-allowed"
          />
          <Button
            type="button"
            variant="outline"
            disabled
          >
            Aplicar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="coupon">¿Tienes un cupón de descuento?</Label>
      <div className={`flex gap-2 ${shakeError ? 'animate-shake' : ''}`}>
        <Input
          id="coupon"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          placeholder="CODIGO123"
          className="font-mono"
          onKeyDown={(e) => e.key === 'Enter' && validateCoupon()}
        />
        <Button
          type="button"
          variant="outline"
          onClick={validateCoupon}
          disabled={isValidating || !couponCode.trim()}
        >
          {isValidating ? "Validando..." : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}
