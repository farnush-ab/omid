import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

const VARIANTS = {
  primary: 'bg-accent text-accent-fg hover:brightness-110',
  secondary: 'border border-line text-fg hover:bg-hover',
  ghost: 'text-fg hover:bg-hover',
  danger: 'border border-line text-down hover:bg-hover',
} as const;

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
