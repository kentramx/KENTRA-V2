# Reglas de Negocio: Límites y Publicaciones

Este documento detalla todas las reglas de negocio relacionadas con límites de propiedades, slots adicionales, propiedades destacadas y comportamiento según el estado de suscripción en Kentra.

---

## 📋 Índice

1. [Límites por Plan](#límites-por-plan)
2. [Slots Adicionales (Upsells)](#slots-adicionales-upsells)
3. [Propiedades Destacadas](#propiedades-destacadas)
4. [Estados de Suscripción](#estados-de-suscripción)
5. [Flujo de Publicación](#flujo-de-publicación)
6. [Upgrade y Downgrade](#upgrade-y-downgrade)
7. [Arquitectura Técnica](#arquitectura-técnica)

---

## 🎯 Límites por Plan

### Fuente de Verdad

Los límites se definen en la base de datos en la tabla `subscription_plans`, campo `features`:

```json
{
  "max_properties": 5,        // Número máximo de propiedades activas (-1 = ilimitado)
  "featured_listings": 2,     // Propiedades destacadas incluidas por mes
  "autopublicacion": false,   // Publicación sin moderación
  "reportes_avanzados": true, // Acceso a reportes avanzados
  "gestion_equipo": false,    // Gestión de equipo (inmobiliarias)
  "landing_pages": false,     // Landing pages personalizadas
  "soporte_prioritario": true // Soporte prioritario
}
```

### Planes Típicos

#### Para Agentes Individuales

| Plan | Max Propiedades | Destacadas/Mes | Precio Mensual |
|------|-----------------|----------------|----------------|
| **Básico** | 5 | 1 | $299 MXN |
| **Pro** | 10 | 3 | $499 MXN |
| **Elite** | Ilimitadas (-1) | 5 | $799 MXN |

#### Para Inmobiliarias

| Plan | Max Propiedades | Agentes | Precio Mensual |
|------|-----------------|---------|----------------|
| **Básico** | 25 | 3 | $1,499 MXN |
| **Pro** | 50 | 7 | $2,999 MXN |
| **Elite** | Ilimitadas | 15 | $4,999 MXN |

### Usuario Sin Plan (Buyer)

- **Límite**: 1 propiedad gratis
- **Propósito**: Permitir que particulares vendan/renten su propiedad
- **Restricción**: Para publicar más, deben convertirse en agentes

---

## ➕ Slots Adicionales (Upsells)

### Concepto

Los usuarios pueden comprar **slots adicionales** que se suman a su límite base del plan.

**Ejemplo**:
- Plan Básico: 5 propiedades base
- Compra 2 slots adicionales
- **Total disponible**: 7 propiedades

### Tabla: `user_active_upsells`

Registra los upsells activos de cada usuario:

```sql
CREATE TABLE user_active_upsells (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  upsell_id UUID NOT NULL,
  upsell_type TEXT NOT NULL,        -- 'slot_propiedad', 'destacar_propiedad', etc.
  quantity INTEGER DEFAULT 1,        -- Cuántos slots/destacadas da este upsell
  status TEXT DEFAULT 'active',      -- 'active', 'expired', 'canceled'
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,              -- NULL si es recurrente sin fin
  auto_renew BOOLEAN DEFAULT false
);
```

### Tipos de Upsells

1. **Slot Adicional de Propiedad** (Recurrente mensual)
   - Tipo: `slot_propiedad`
   - Cantidad: 1 slot por upsell
   - Precio: $49 MXN/mes
   - Acumulable: Sí (puede comprar múltiples)

2. **Destacar Propiedad** (Pago único)
   - Tipo: `destacar_propiedad`
   - Duración: 7, 15 o 30 días
   - Precio: Variable según duración
   - Acumulable: Sí

### Cálculo de Límite Total

```
Límite Total = 
  max_properties (del plan base)
  + SUM(quantity WHERE upsell_type = 'slot_propiedad' AND status = 'active')
```

**Ejemplo de Cálculo:**

Usuario con plan Básico (5 propiedades):
- 2 upsells de "Slot Adicional" activos
- **Límite total**: 5 + 2 = **7 propiedades**

### Implementación Técnica

#### Frontend (Validación)
```typescript
// src/config/subscriptionBusinessRules.ts
import { validatePropertyLimits } from '@/config/subscriptionBusinessRules';

const validation = await validatePropertyLimits(userId);

if (!validation.canPublish) {
  // Mostrar mensaje: validation.reason
  // Ofrecer upgrade o compra de slots
}
```

#### Backend (Validación Definitiva)
```sql
-- Función: can_create_property_with_upsells(user_uuid)
-- Considera: plan base + upsells activos
```

---

## ⭐ Propiedades Destacadas

### Concepto

Las propiedades destacadas aparecen:
- En los primeros resultados de búsqueda
- Con badge especial "Destacada"
- En secciones destacadas de la home

### Límite Mensual Incluido

Cada plan incluye un número de propiedades destacadas **por mes**.

**Ejemplo**: Plan Pro incluye 3 destacadas/mes
- El usuario puede destacar hasta 3 propiedades diferentes en el mes
- Al inicio del nuevo ciclo mensual, el contador se resetea

### Reseteo Mensual

Se maneja en la función `get_user_subscription_info()`:

```sql
-- Verifica si pasó el mes desde featured_reset_date
-- Si sí: resetea featured_used_this_month a 0
```

### Duración de Destacado

Por defecto: **30 días** desde que se activa.

Tabla `featured_properties`:
```sql
CREATE TABLE featured_properties (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  featured_type TEXT DEFAULT 'standard', -- 'standard', 'premium', 'portada'
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,         -- NOW() + 30 días
  cost DECIMAL(10,2),                    -- Costo pagado (si aplica)
  status TEXT DEFAULT 'active',          -- 'active', 'expired', 'paused'
  stripe_payment_intent_id TEXT
);
```

### Validación para Destacar

Antes de permitir destacar una propiedad:

1. **Verificar límite del plan**:
   ```typescript
   const validation = await validateFeaturedLimits(userId);
   if (!validation.canFeature) {
     // Mostrar mensaje
     // Ofrecer upgrade o compra de upsell de destacado
   }
   ```

2. **Insertar registro en `featured_properties`**:
   ```sql
   INSERT INTO featured_properties (property_id, agent_id, end_date, cost)
   VALUES (?, ?, NOW() + INTERVAL '30 days', 500);
   ```

3. **Incrementar contador mensual**:
   Automático mediante trigger `increment_featured_count()`

---

## 🔄 Estados de Suscripción

### Estados Posibles

| Estado | Descripción | Puede Publicar | Puede Destacar |
|--------|-------------|----------------|----------------|
| **active** | Suscripción activa y pagada | ✅ Sí | ✅ Sí |
| **trialing** | Período de prueba gratuito | ✅ Sí (según límite) | ✅ Sí (según límite) |
| **past_due** | Pago fallido, en período de gracia | ⚠️ No | ⚠️ No |
| **canceled** | Cancelada por el usuario | ⏳ Hasta period_end | ⏳ Hasta period_end |
| **incomplete** | Pago incompleto (requiere acción) | ❌ No | ❌ No |

### Comportamiento por Estado

#### `active`
- **Funcionalidad completa** según el plan contratado
- Límites normales aplicables

#### `trialing`
- Usuario en **período de prueba** (14 días típicamente)
- Límites según el plan de trial (ejemplo: 3 propiedades)
- Al finalizar el trial:
  - Si hay método de pago → cobro automático → `active`
  - Si no hay método de pago → `expired` → bloquear publicación

#### `past_due`
- **Pago falló** pero hay período de gracia (7 días)
- **Bloquear nuevas publicaciones**
- **Bloquear destacar propiedades**
- Mostrar banner: "Hay un problema con tu pago. Actualiza tu método de pago."
- Propiedades existentes siguen visibles (por ahora)

#### `canceled`
- Usuario **canceló su plan**
- Mantener acceso hasta `current_period_end` (lo que ya pagó)
- Después de `current_period_end`:
  - Bloquear publicaciones
  - Pausar propiedades activas (opcional, según regla de negocio)

#### `incomplete`
- Pago iniciado pero **no completado**
- Bloquear funciones hasta completar pago

### Implementación

```typescript
// src/config/subscriptionBusinessRules.ts

export function isSubscriptionOperational(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing';
}

export function requiresUserAction(status: SubscriptionStatus): boolean {
  return status === 'past_due' || status === 'incomplete';
}
```

---

## 📝 Flujo de Publicación

### Flujo Completo

```
┌─────────────────────────────────────────────────────┐
│ Usuario hace clic en "Publicar Propiedad"          │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 1. Verificar email confirmado                       │
│    Si no → Mostrar aviso de verificación            │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 2. Validar límites (frontend)                       │
│    validatePropertyLimits(userId)                   │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   canPublish?          No
        │                 │
       Yes                ▼
        │        ┌─────────────────────────────┐
        │        │ Mostrar mensaje de límite   │
        │        │ Ofrecer:                     │
        │        │ - Upgrade de plan            │
        │        │ - Compra de slot adicional   │
        │        └─────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│ 3. Mostrar formulario de propiedad                  │
│    Usuario llena datos, sube imágenes               │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 4. Submit del formulario                            │
│    - Validaciones de campo (zod schema)             │
│    - Detección de duplicados (título similar)       │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 5. Validación definitiva en DB                      │
│    can_create_property_with_upsells(user_uuid)      │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
     Permite?            No
        │                 │
       Yes                ▼
        │        ┌─────────────────────────────┐
        │        │ Error: Límite excedido      │
        │        │ (Esto no debería pasar si   │
        │        │  la validación frontend      │
        │        │  funcionó correctamente)     │
        │        └─────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│ 6. Insertar propiedad con status = 'pausada'        │
│    (Envío a moderación)                             │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 7. Subir imágenes a Supabase Storage                │
│    Crear registros en tabla 'images'                │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 8. Notificar al usuario                             │
│    - Si hay duplicado detectado: "En revisión"      │
│    - Si todo OK: "Enviada para aprobación"          │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 9. Redirigir a lista de propiedades                 │
└─────────────────────────────────────────────────────┘
```

### Validaciones en Cada Paso

#### En Frontend (antes de mostrar formulario)

```typescript
// src/pages/AgentDashboard.tsx
const handleNewProperty = async () => {
  // Validación de límites
  const { data: validation } = await supabase.rpc('can_create_property', {
    user_uuid: user.id,
  });

  if (!validation[0]?.can_create) {
    toast({
      title: 'Límite alcanzado',
      description: validation[0]?.reason + ' ' + upgradeMessage,
      variant: 'destructive',
    });
    return;
  }

  // Mostrar formulario
  setActiveTab('form');
};
```

#### En Backend (al insertar)

```sql
-- Función: can_create_property_with_upsells(user_uuid)
-- Retorna: (can_create, reason, current_count, max_allowed)

SELECT can_create, reason FROM can_create_property_with_upsells(user_uuid);
-- Si can_create = false → rechazar inserción
```

---

## 🔼🔽 Upgrade y Downgrade

### Upgrade (Cambio a Plan Superior)

**Escenario**: Usuario con plan Básico (5 propiedades) → Pro (10 propiedades)

**Comportamiento**:
1. ✅ Cambio **inmediato** de límite
2. ✅ Nuevas propiedades disponibles de inmediato
3. ✅ Cobro prorrateado por Stripe (si mensual)
4. ✅ Actualizar `user_subscriptions.plan_id` al nuevo plan

**No hay restricciones** para upgrade.

### Downgrade (Cambio a Plan Inferior)

**Escenario**: Usuario con plan Pro (10 propiedades, 7 activas) → Básico (5 propiedades)

**Problema**: Tiene 7 propiedades activas pero el nuevo plan solo permite 5.

**Soluciones Posibles**:

#### Opción A: Bloquear Downgrade (Recomendado)
```typescript
const validation = await validateDowngrade(userId, newPlanMaxProperties);

if (!validation.canDowngrade) {
  toast({
    title: 'No se puede hacer el cambio',
    description: validation.reason,
    // "Tienes 7 propiedades activas, pero el plan Básico permite solo 5.
    //  Debes desactivar 2 propiedades primero."
  });
  return;
}
```

#### Opción B: Pausar Propiedades Excedentes
- Permitir el downgrade
- Automáticamente **pausar** las propiedades más antiguas hasta cumplir el nuevo límite
- Notificar al usuario: "Se pausaron 2 de tus propiedades. Reactívalas cuando cumplas el límite."

#### Opción C: Período de Gracia
- Permitir el downgrade
- Dar 30 días de **gracia** antes de pausar propiedades excedentes
- Notificar: "Tienes 30 días para desactivar 2 propiedades o mejorar tu plan de nuevo."

**Recomendación**: Usar **Opción A** (bloquear) para evitar confusión.

### Implementación de Validación

```typescript
// src/config/subscriptionBusinessRules.ts
export async function validateDowngrade(
  userId: string,
  newPlanMaxProperties: number
): Promise<{ canDowngrade: boolean; reason: string; excessCount: number }> {
  const { data: subInfo } = await supabase.rpc('get_user_subscription_info', {
    user_uuid: userId,
  });

  const currentUsed = subInfo[0].properties_used;

  if (currentUsed > newPlanMaxProperties) {
    const excess = currentUsed - newPlanMaxProperties;
    return {
      canDowngrade: false,
      reason: `Tienes ${currentUsed} propiedades activas, pero el plan nuevo permite solo ${newPlanMaxProperties}. Debes desactivar ${excess} propiedad${excess === 1 ? '' : 'es'} primero.`,
      excessCount: excess,
    };
  }

  return { canDowngrade: true, reason: '', excessCount: 0 };
}
```

---

## 🏗️ Arquitectura Técnica

### Centralización de Lógica

#### Archivo: `src/config/subscriptionBusinessRules.ts`

- ✅ Funciones de validación reutilizables
- ✅ Constantes centralizadas
- ✅ Helpers para cálculos de límites
- ✅ Mensajes amigables según estado

#### Funciones de Base de Datos

1. **`get_user_subscription_info(user_uuid)`**
   - Retorna toda la info de suscripción del usuario
   - Incluye: plan, límites, uso actual, estado
   - **Se ejecuta en cada carga del dashboard**

2. **`can_create_property_with_upsells(user_uuid)`**
   - Valida si el usuario puede crear propiedades
   - Considera: plan base + upsells activos + estado de suscripción
   - **Se ejecuta antes de mostrar formulario de publicación**

3. **`increment_featured_count()`**
   - Trigger que incrementa `featured_used_this_month`
   - Se dispara al insertar en `featured_properties`

### Flujo de Datos

```
┌─────────────────────────────────────────────────────┐
│ Frontend (React)                                    │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ src/config/subscriptionBusinessRules.ts         ││
│ │ - validatePropertyLimits()                      ││
│ │ - validateFeaturedLimits()                      ││
│ │ - validateDowngrade()                           ││
│ └────────────────┬────────────────────────────────┘│
│                  │                                  │
│                  │ Llama a RPC ↓                    │
└──────────────────┼──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Supabase Database                                   │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ RPC Functions                                   ││
│ │ - get_user_subscription_info(user_uuid)         ││
│ │ - can_create_property_with_upsells(user_uuid)   ││
│ └────────────────┬────────────────────────────────┘│
│                  │                                  │
│                  │ Consulta ↓                       │
│                  │                                  │
│ ┌────────────────┴────────────────────────────────┐│
│ │ Tables                                          ││
│ │ - user_subscriptions                            ││
│ │ - subscription_plans                            ││
│ │ - user_active_upsells                           ││
│ │ - properties (COUNT WHERE status='activa')      ││
│ │ - featured_properties                           ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Componentes de UI Involucrados

| Componente | Responsabilidad |
|------------|-----------------|
| **AgentDashboard** | Botón "Nueva Propiedad" → valida límites antes de mostrar form |
| **PropertyForm** | Formulario de creación → valida email y ejecuta inserción |
| **PlanStatusCard** | Muestra uso actual / límite con barras de progreso |
| **PlanMetricsCards** | Tarjetas con métricas de uso (propiedades, destacadas) |
| **QuickUpsells** | Sugerencias contextuales de upsells (si cerca del límite) |
| **AgentUpsells** | Catálogo completo de upsells disponibles |
| **FeaturePropertyDialog** | Diálogo para destacar → valida límite de destacadas |
| **ChangePlanDialog** | Cambio de plan → valida downgrade antes de permitir |

---

## 🧪 Testing y Casos de Prueba

### Escenarios a Probar

#### 1. Usuario Sin Plan
- [ ] Puede publicar 1 propiedad gratis
- [ ] Al intentar publicar segunda, se bloquea con mensaje claro
- [ ] Se le redirige a /publicar → pricing

#### 2. Usuario con Plan Básico (5 propiedades)
- [ ] Puede publicar hasta 5 propiedades
- [ ] Al llegar a 5, se muestra mensaje de límite
- [ ] Se ofrece upgrade a Pro o compra de slot adicional
- [ ] Banner de advertencia al 80% (4 propiedades)

#### 3. Usuario con Upsells de Slots
- [ ] Plan Básico (5) + 2 slots = 7 total
- [ ] Puede publicar hasta 7 propiedades
- [ ] Al expirar un slot recurrente, límite baja automáticamente

#### 4. Propiedades Destacadas
- [ ] Plan con 2 destacadas/mes → puede destacar 2
- [ ] Al destacar la tercera, se bloquea con mensaje
- [ ] Al inicio del nuevo mes, contador se resetea a 0
- [ ] Propiedades destacadas expiran después de 30 días

#### 5. Estados de Suscripción
- [ ] `past_due`: Bloquear publicación, mostrar banner de pago
- [ ] `canceled`: Permitir hasta `period_end`, luego bloquear
- [ ] `trialing`: Funciona normal según límites de trial

#### 6. Downgrade
- [ ] Si tiene 7 activas y baja a plan de 5, se bloquea con mensaje claro
- [ ] Si tiene 3 activas y baja a plan de 5, se permite sin problema

---

## 📚 Referencias

- **Código Frontend**: `src/config/subscriptionBusinessRules.ts`
- **Función Principal DB**: `get_user_subscription_info()` en migraciones
- **Validación de Publicación**: `can_create_property_with_upsells()` (a crear)
- **Webhooks Stripe**: `supabase/functions/stripe-webhook/index.ts`
- **Checkout Session**: `supabase/functions/create-checkout-session/index.ts`

---

**Última actualización**: 2025-11-14  
**Responsable**: Sistema de Kentra
