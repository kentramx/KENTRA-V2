import { useState, useEffect } from "react";
import { toast } from "sonner";
import { monitoring } from '@/lib/monitoring';

const STORAGE_KEY = "propertyCompare";
const MAX_COMPARE = 4;

export const usePropertyCompare = () => {
  const [compareList, setCompareList] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCompareList(JSON.parse(stored));
      } catch (error) {
        monitoring.warn("Error loading compare list", { hook: 'usePropertyCompare', error });
      }
    }
  }, []);

  const addToCompare = (propertyId: string) => {
    if (compareList.includes(propertyId)) {
      toast.info("Esta propiedad ya está en tu lista de comparación");
      return false;
    }

    if (compareList.length >= MAX_COMPARE) {
      toast.error(`Solo puedes comparar hasta ${MAX_COMPARE} propiedades`);
      return false;
    }

    const newList = [...compareList, propertyId];
    setCompareList(newList);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    toast.success("Propiedad agregada para comparar");
    return true;
  };

  const removeFromCompare = (propertyId: string) => {
    const newList = compareList.filter((id) => id !== propertyId);
    setCompareList(newList);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    toast.success("Propiedad removida de la comparación");
  };

  const clearCompare = () => {
    setCompareList([]);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Lista de comparación limpiada");
  };

  const isInCompare = (propertyId: string) => {
    return compareList.includes(propertyId);
  };

  return {
    compareList,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    canAddMore: compareList.length < MAX_COMPARE,
  };
};
