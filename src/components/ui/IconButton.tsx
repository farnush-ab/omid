import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly icon?: IconName;
  readonly path?: string;
  readonly label: string;
  readonly shortcut?: string | undefined;
  readonly active?: boolean;
  readonly tooltipSide?: 'bottom' | 'right' | 'top';
  readonly size?: number;
  readonly text?: string;
}

export function IconButton({
  icon,
  path,
  label,
  shortcut,
  active = false,
  tooltipSide = 'bottom',
  size = 18,
  text,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-fg transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-35 ${active ? 'text-accent' : ''} ${className}`}
        {...rest}
      >
        {icon || path ? (
          <Icon {...(icon ? { name: icon } : {})} {...(path ? { path } : {})} size={size} />
        ) : null}
        {text ? <span className="text-[13px] font-medium">{text}</span> : null}
      </button>
    </Tooltip>
  );
}
