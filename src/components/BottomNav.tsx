import { Home, Search, Heart, PlusCircle, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const BottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  const navItems = [
    { icon: Home, label: 'Inicio', path: '/' },
    { icon: Search, label: 'Buscar', path: '/buscar' },
    { icon: PlusCircle, label: 'Publicar', path: '/publicar', highlight: true },
    { icon: Heart, label: 'Favoritos', path: '/favoritos' },
    { icon: User, label: 'Perfil', path: user ? '/perfil' : '/auth' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
      <div className="flex justify-around items-center h-16 pb-safe">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                item.highlight 
                  ? "text-amber-500" 
                  : isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn(
                "h-6 w-6",
                item.highlight && "h-7 w-7"
              )} />
              <span className={cn(
                "text-xs font-medium",
                item.highlight && "font-semibold"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
