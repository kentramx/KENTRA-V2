import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "compact" | "centered";
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "default" && "py-16 px-6",
        variant === "compact" && "py-8 px-4",
        variant === "centered" && "min-h-[400px] py-16 px-6",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-6 rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
      {children}
    </div>
  );
}

// Specific empty state presets
interface EmptyStatePresetProps extends Omit<EmptyStateProps, "icon" | "title" | "description"> {
  customTitle?: string;
  customDescription?: string;
}

function EmptyStateNoResults({ customTitle, customDescription, ...props }: EmptyStatePresetProps) {
  return (
    <EmptyState
      title={customTitle || "No se encontraron resultados"}
      description={customDescription || "Intenta ajustar los filtros o buscar con otros términos."}
      {...props}
    />
  );
}

function EmptyStateFavorites({ customTitle, customDescription, ...props }: EmptyStatePresetProps) {
  return (
    <EmptyState
      title={customTitle || "No tienes favoritos aún"}
      description={customDescription || "Guarda propiedades que te interesen para verlas después."}
      {...props}
    />
  );
}

function EmptyStateMessages({ customTitle, customDescription, ...props }: EmptyStatePresetProps) {
  return (
    <EmptyState
      title={customTitle || "Sin mensajes"}
      description={customDescription || "Aquí aparecerán tus conversaciones con agentes."}
      {...props}
    />
  );
}

function EmptyStateProperties({ customTitle, customDescription, ...props }: EmptyStatePresetProps) {
  return (
    <EmptyState
      title={customTitle || "Sin propiedades"}
      description={customDescription || "Aún no has publicado ninguna propiedad."}
      {...props}
    />
  );
}

export {
  EmptyState,
  EmptyStateNoResults,
  EmptyStateFavorites,
  EmptyStateMessages,
  EmptyStateProperties,
};
