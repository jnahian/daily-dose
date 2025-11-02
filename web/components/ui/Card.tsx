import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  hoverable?: boolean;
}

export default function Card({
  title,
  description,
  icon,
  children,
  className,
  hoverable = true,
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl p-6 shadow-sm border border-gray-200",
        "transition-all duration-300",
        {
          "hover:shadow-xl hover:-translate-y-1 hover:border-primary/20":
            hoverable,
        },
        className
      )}
    >
      {icon && <div className="mb-4 text-primary">{icon}</div>}
      {title && (
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-gray-600 leading-relaxed">{description}</p>
      )}
      {children}
    </div>
  );
}
