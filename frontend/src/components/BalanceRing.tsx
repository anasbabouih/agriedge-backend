'use client';

import { motion } from 'framer-motion';

interface BalanceRingProps {
  current: number;
  max?: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Circular SVG progress ring that animates the arc from 0 to the current value.
 * Defaults: max = 30 days (standard Algerian annual leave), size = 120px.
 */
export function BalanceRing({
  current,
  max = 30,
  label = 'jours',
  size = 120,
  strokeWidth = 10,
}: BalanceRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(current / max, 0), 1);
  const offset = circumference * (1 - pct);

  // Color transitions: green → amber → red as balance drops
  const color =
    pct > 0.5 ? '#10b981'   // emerald
    : pct > 0.25 ? '#f59e0b' // amber
    : '#ef4444';              // red

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Track */}
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border opacity-50"
          />
          {/* Animated progress arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>

        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5, ease: 'backOut' }}
            className="text-2xl font-bold tracking-tight"
            style={{ color }}
          >
            {current % 1 === 0 ? current : current.toFixed(1)}
          </motion.span>
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
