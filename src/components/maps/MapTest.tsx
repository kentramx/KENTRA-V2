/**
 * Componente temporal para probar el mapa
 * ELIMINAR después de verificar que funciona
 */

import { MapboxMap } from './MapboxMap';

export function MapTest() {
  return (
    <div className="w-full h-[500px] border rounded-lg overflow-hidden">
      <MapboxMap />
    </div>
  );
}
