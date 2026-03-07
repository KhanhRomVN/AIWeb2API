import { memo } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { motion } from 'framer-motion';
import { staggerItem } from '../../../shared/components/AnimatedPage';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  color?: string; // e.g., "text-violet-500", "border-violet-500"
}

export const SummaryCard = memo(
  ({
    title,
    value,
    icon: Icon,
    description,
    trend,
    className,
    color = 'text-primary',
  }: SummaryCardProps) => {
    return (
      <motion.div
        variants={staggerItem}
        className={cn(
          'relative overflow-hidden rounded-xl border bg-card/50 text-card-foreground cursor-default flex flex-col',
          className,
        )}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-card/30">
          <Icon size={14} className={color} />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
        </div>
        <div className="px-4 py-5">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        </div>
      </motion.div>
    );
  },
);
