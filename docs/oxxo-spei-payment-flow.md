# Soporte OXXO y SPEI en Suscripciones

## Resumen

El sistema de suscripciones de Kentra ahora soporta **pagos en efectivo (OXXO)** y **transferencias bancarias SPEI**, además de las tarjetas de crédito/débito tradicionales.

## Flujo de Pago Pendiente

### 1. Checkout (create-checkout-session)

Cuando un usuario selecciona OXXO o SPEI como método de pago:

```typescript
payment_method_types: ['card', 'oxxo', 'customer_balance']
payment_method_options: {
  customer_balance: {
    funding_type: 'bank_transfer',
    bank_transfer: { type: 'mx_bank_transfer' }
  }
}
```

### 2. Webhook: checkout.session.completed

Si `session.payment_status === 'unpaid'`:

- ✅ Se crea registro en `pending_payments` (tracking)
- ✅ Se crea suscripción con `status: 'incomplete'`
- ✅ Se envía email con instrucciones de pago (`type: 'payment_pending'`)

**Datos guardados:**
```json
{
  "checkout_session_id": "cs_xxx",
  "payment_method": "oxxo" | "customer_balance",
  "expires_at": "now + 48 horas",
  "status": "pending"
}
```

### 3. Usuario Completa el Pago

**OXXO:**
- Acude a tienda OXXO con voucher
- Paga en efectivo (confirmación en 24-48h)

**SPEI:**
- Realiza transferencia bancaria
- Confirmación en minutos

### 4. Webhook: invoice.payment_succeeded

Cuando Stripe confirma el pago:

- ✅ Busca suscripción `incomplete` por `user_id`
- ✅ Actualiza a `status: 'active'` y asigna `stripe_subscription_id`
- ✅ Marca `pending_payment` como `completed`
- ✅ Registra en `payment_history`
- ✅ Envía email de confirmación (`type: 'first_payment_success'`)

## Estados de Suscripción

| Status       | Descripción                                    |
|-------------|------------------------------------------------|
| `incomplete` | Pago pendiente (OXXO/SPEI sin confirmar)      |
| `active`    | Pago confirmado, suscripción activa           |
| `expired`   | Pago pendiente expiró (>48h sin confirmar)    |

## Tabla: pending_payments

```sql
CREATE TABLE pending_payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  checkout_session_id TEXT UNIQUE,
  payment_method TEXT,  -- 'oxxo', 'customer_balance'
  plan_id UUID,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'MXN',
  status TEXT DEFAULT 'pending',  -- 'pending', 'completed', 'expired'
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);
```

## Expiración Automática

**Cron Job:** `expire-pending-payments` (cada 6 horas)

```sql
SELECT cron.schedule(
  'expire-pending-payments',
  '0 */6 * * *',
  $$ ... $$
);
```

**Lógica:**
- Marca `pending_payments` con >48h como `expired`
- Marca suscripciones `incomplete` con >48h como `expired`

## UI: SubscriptionManagement.tsx

Muestra banner amarillo cuando `status === 'incomplete'`:

```tsx
{isPending && (
  <Alert className="bg-amber-50">
    <Clock className="h-5 w-5 text-amber-600" />
    <h4>Pago Pendiente</h4>
    <p>
      {paymentMethod === 'oxxo' && "Revisa tu correo para las instrucciones de pago en OXXO..."}
      {paymentMethod === 'customer_balance' && "Realiza la transferencia SPEI..."}
    </p>
  </Alert>
)}
```

## Notificaciones por Email

### payment_pending
- **Cuándo:** Al crear checkout con OXXO/SPEI
- **Contenido:** Instrucciones de pago, monto, límite de 48h

### first_payment_success
- **Cuándo:** Al confirmar pago pendiente
- **Contenido:** Confirmación de activación, detalles del plan

## Testing

### Test Mode (Stripe Dashboard)

1. **OXXO:**
   - Genera voucher instantáneo
   - Simula pago desde Dashboard → Payments → Mark as paid

2. **SPEI:**
   - Genera CLABE temporal
   - Simula transferencia desde Dashboard

### Test Completo

```bash
# 1. Crear checkout con OXXO
POST /create-checkout-session
{ planId: "...", billingCycle: "monthly" }

# 2. Verificar webhook checkout.session.completed
# → pending_payments.status = 'pending'
# → user_subscriptions.status = 'incomplete'

# 3. Simular pago en Stripe Dashboard

# 4. Verificar webhook invoice.payment_succeeded
# → pending_payments.status = 'completed'
# → user_subscriptions.status = 'active'
```

## Métricas a Monitorear

1. **Tasa de Conversión:** % de `pending` → `completed`
2. **Tiempo Promedio:** `created_at` → `completed_at`
3. **Tasa de Expiración:** % de `pending` → `expired`
4. **Preferencia de Método:** OXXO vs SPEI vs Card

## Próximos Pasos

- [ ] Dashboard admin para ver pending_payments
- [ ] Recordatorios antes de expirar (24h)
- [ ] Permitir re-generar voucher expirado
- [ ] Analytics de métodos de pago por demografía
