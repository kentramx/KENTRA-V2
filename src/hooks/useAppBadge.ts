import { useEffect } from 'react';

interface Navigator {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

export const useAppBadge = (count: number) => {
  useEffect(() => {
    const updateBadge = async () => {
      // Verificar si la API de Badge está disponible
      const nav = navigator as Navigator;
      
      if (!nav.setAppBadge || !nav.clearAppBadge) {
        console.log('Badge API no está disponible en este navegador');
        return;
      }

      try {
        if (count > 0) {
          // Establecer el badge con el número de mensajes no leídos
          await nav.setAppBadge(count);
          console.log(`Badge actualizado a: ${count}`);
        } else {
          // Limpiar el badge si no hay mensajes no leídos
          await nav.clearAppBadge();
          console.log('Badge limpiado');
        }
      } catch (error) {
        console.error('Error actualizando el badge:', error);
      }
    };

    updateBadge();

    // Limpiar el badge cuando el componente se desmonte
    return () => {
      const nav = navigator as Navigator;
      if (nav.clearAppBadge) {
        nav.clearAppBadge().catch(console.error);
      }
    };
  }, [count]);

  const clearBadge = async () => {
    const nav = navigator as Navigator;
    if (nav.clearAppBadge) {
      try {
        await nav.clearAppBadge();
      } catch (error) {
        console.error('Error limpiando el badge:', error);
      }
    }
  };

  const setBadge = async (newCount: number) => {
    const nav = navigator as Navigator;
    if (nav.setAppBadge) {
      try {
        await nav.setAppBadge(newCount);
      } catch (error) {
        console.error('Error estableciendo el badge:', error);
      }
    }
  };

  return { clearBadge, setBadge };
};
