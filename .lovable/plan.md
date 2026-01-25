
# Plan para Corregir Errores de TypeScript en Edge Functions

## Problema
El proyecto no puede compilarse debido a errores de TypeScript en 3 archivos compartidos de las Edge Functions. Esto causa que veas "Preview has not been built yet" en Lovable.

## Archivos a Corregir

### 1. emailHelper.ts
**Error:** El tipo de retorno `data` es incompatible con la definición de la función.

**Solución:** Cambiar el tipo de retorno de `data` de `Record<string, unknown>` a `unknown` para aceptar cualquier respuesta de la API de Resend:
```text
Antes:  Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
Después: Promise<{ success: boolean; data?: unknown; error?: string }>
```

### 2. retry.ts  
**Error:** No se puede convertir `Error` directamente a `Record<string, unknown>` para acceder a propiedades como `statusCode`.

**Solución:** Usar conversión segura a través de `unknown` primero y tipar `statusCode` correctamente:
```text
Antes:  (error as Record<string, unknown>).statusCode
Después: const err = error as unknown as Record<string, unknown>;
         const statusCode = typeof err.statusCode === 'number' ? err.statusCode 
                          : typeof err.status === 'number' ? err.status : undefined;
```

### 3. validation.ts
**Error:** El tipo `object` no tiene propiedades indexables en TypeScript estricto.

**Solución:** Hacer casting a `Record<string, unknown>` después de verificar que es objeto:
```text
Antes:  if (body.upsellOnly !== true)
Después: const b = body as Record<string, unknown>;
         if (b.upsellOnly !== true)
```

## Cambios Específicos

| Archivo | Línea(s) | Cambio |
|---------|----------|--------|
| emailHelper.ts | 130, 176, 189 | Cambiar tipo `data` a `unknown` |
| retry.ts | 63-84, 89-102 | Refactorizar funciones de retry con tipos seguros |
| validation.ts | 34-96, 106-142, 151-183, 192-223 | Usar `Record<string, unknown>` en lugar de `object` |

## Resumen Técnico
- **Total de errores:** ~35 errores de TypeScript
- **Tiempo estimado de corrección:** Inmediato al aprobar
- **Impacto:** Una vez corregidos, el build pasará y el preview funcionará correctamente
