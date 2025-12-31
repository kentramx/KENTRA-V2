/**
 * PropertyCardSkeleton - TIER S Skeleton loader with shimmer
 */

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PropertyCardSkeletonProps {
  className?: string;
}

export const PropertyCardSkeleton = ({ className }: PropertyCardSkeletonProps) => {
  return (
    <div className={cn(
      "h-full flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card",
      className
    )}>
      {/* Image skeleton with shimmer */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl">
        <Skeleton className="h-full w-full skeleton-shimmer" />
        {/* Badges skeleton */}
        <div className="absolute top-3 left-3 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="absolute right-3 bottom-3 h-5 w-14 rounded-full" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-5 space-y-3">
        {/* Price */}
        <Skeleton className="h-8 w-2/3" />
        
        {/* Features */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-14" />
        </div>

        {/* Title */}
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />

        {/* Location */}
        <Skeleton className="h-4 w-1/2" />
        
        {/* Days on market */}
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
};

export const PropertyGridSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 stagger-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
};
