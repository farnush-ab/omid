import { ICONS, type IconName } from './icons';

interface IconProps {
  readonly name?: IconName;
  /** Raw path data (e.g. from a drawing tool definition). */
  readonly path?: string;
  readonly size?: number;
  readonly className?: string;
  readonly strokeWidth?: number;
}

export function Icon({ name, path, size = 18, className, strokeWidth = 1.6 }: IconProps) {
  const d = path ?? (name ? ICONS[name] : '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
