/**
 * Buscar - Property Search Page with Interactive Map
 * Split-panel layout: 30% list, 70% map
 */

import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { SearchMap, SearchFilters, SearchPropertyList } from '@/components/search';
import { useMapStore } from '@/stores/mapStore';
import { Drawer } from 'vaul';
import { Button } from '@/components/ui/button';
import { List, Map } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Buscar() {
  const isMobile = useIsMobile();
  const { resetFilters } = useMapStore();

  // Reset filters on unmount
  useEffect(() => {
    return () => {
      resetFilters();
    };
  }, [resetFilters]);

  if (isMobile) {
    return <MobileLayout />;
  }

  return <DesktopLayout />;
}

function DesktopLayout() {
  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      
      {/* Filters */}
      <SearchFilters />
      
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List - 30% */}
        <div className="w-[380px] flex-shrink-0 border-r border-border bg-muted/30 overflow-hidden">
          <SearchPropertyList />
        </div>
        
        {/* Map - 70% */}
        <div className="flex-1 relative">
          <SearchMap />
        </div>
      </div>
    </div>
  );
}

function MobileLayout() {
  const { totalCount, isLoading } = useMapStore();

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      
      {/* Filters */}
      <SearchFilters />
      
      {/* Map - fullscreen */}
      <div className="flex-1 relative">
        <SearchMap />
        
        {/* Drawer trigger */}
        <Drawer.Root>
          <Drawer.Trigger asChild>
            <Button 
              className="absolute bottom-6 left-1/2 -translate-x-1/2 shadow-lg z-10"
              size="lg"
            >
              <List className="h-4 w-4 mr-2" />
              {isLoading ? 'Buscando...' : `Ver ${totalCount.toLocaleString()} propiedades`}
            </Button>
          </Drawer.Trigger>
          
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex h-[85vh] flex-col rounded-t-2xl bg-background">
              <div className="mx-auto mt-4 h-1.5 w-12 flex-shrink-0 rounded-full bg-muted-foreground/20" />
              <div className="flex-1 overflow-hidden">
                <SearchPropertyList />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </div>
  );
}
