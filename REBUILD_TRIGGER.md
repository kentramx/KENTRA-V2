# Rebuild Trigger

Timestamp: 2025-11-23 19:30

## Objetivo
Forzar rebuild del preview de Lovable para inyectar la variable de entorno `VITE_MAPBOX_ACCESS_TOKEN` en tiempo de build.

## Variables de entorno requeridas
- `VITE_MAPBOX_ACCESS_TOKEN` (configurada en Lovable Cloud Secrets)

## Archivos modificados
- src/pages/BuscarV2.tsx (comentario de rebuild)
- src/components/SearchMapMapboxV2.tsx (comentario de rebuild + logs agresivos)
- REBUILD_TRIGGER.md (este archivo - forzar cambio en el proyecto)

## Logs esperados después del rebuild

Si el token existe:
```
🗺️ [SearchMapMapboxV2] COMPONENTE MONTADO { ... }
🔑 [Mapbox Token Check] INICIO { hasVITE_MAPBOX_ACCESS_TOKEN: true, tokenLength: 107, ... }
✅ [Mapbox] Token configurado correctamente { tokenLength: 107, ... }
```

Si el token NO existe:
```
🗺️ [SearchMapMapboxV2] COMPONENTE MONTADO { ... }
🔑 [Mapbox Token Check] INICIO { hasVITE_MAPBOX_ACCESS_TOKEN: false, tokenLength: 0, ... }
🚨 [SearchMapMapboxV2] ERROR CRÍTICO: ❌ FALTA TOKEN DE MAPBOX...
```
