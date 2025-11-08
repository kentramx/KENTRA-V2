import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbItem {
  label: string;
  href: string;
  active: boolean;
}

interface DynamicBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const DynamicBreadcrumbs = ({ items, className }: DynamicBreadcrumbsProps) => {
  if (!items || items.length === 0) return null;

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items.map((item, index, array) => (
          <div key={item.href} className="contents">
            <BreadcrumbItem>
              {item.active ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < array.length - 1 && <BreadcrumbSeparator />}
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
