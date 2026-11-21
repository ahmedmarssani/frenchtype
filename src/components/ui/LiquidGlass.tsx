import React from 'react';
import {X, type LucideIcon} from 'lucide-react';
import {AVATAR_GRADIENTS} from '../../theme/liquidGlassTheme';
import {triggerLightHaptic} from '../../utils/haptics';

/* -------------------------------------------------------------------------- */
/* GlassCard                                                                  */
/* -------------------------------------------------------------------------- */
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'strong' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const PADDING_MAP = {
  none: '',
  sm: 'p-3.5 sm:p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-5 sm:p-7',
} as const;

export const GlassCard: React.FC<GlassCardProps> = ({
  variant = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}) => {
  const surfaceClass =
    variant === 'strong'
      ? 'lg-surface-strong'
      : variant === 'subtle'
      ? 'lg-surface-subtle'
      : 'lg-surface';

  return (
    <div
      className={`${surfaceClass} rounded-[22px] ${PADDING_MAP[padding]} ${
        interactive ? 'lg-press cursor-pointer hover:brightness-[1.02]' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* GlassButton                                                                */
/* -------------------------------------------------------------------------- */
interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'glass' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  haptic?: boolean;
}

const BTN_SIZE_MAP = {
  sm: 'min-h-[44px] px-3.5 py-2 text-xs rounded-[14px]',
  md: 'min-h-[48px] px-4 py-2.5 text-sm rounded-[16px]',
  lg: 'min-h-[52px] px-6 py-3 text-sm sm:text-base rounded-[18px]',
} as const;

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'glass',
  size = 'md',
  haptic = true,
  className = '',
  style,
  onClick,
  children,
  type = 'button',
  ...rest
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (haptic) void triggerLightHaptic();
    onClick?.(e);
  };

  let variantClasses = 'lg-surface-subtle hover:brightness-[1.03]';
  let variantStyle: React.CSSProperties = {color: 'var(--tx)'};

  if (variant === 'primary') {
    variantClasses = 'shadow-md hover:brightness-105';
    variantStyle = {
      background: 'linear-gradient(135deg, var(--main), var(--accent-violet))',
      color: 'var(--main-fg)',
      boxShadow: '0 8px 22px -6px rgba(79, 109, 245, 0.42), inset 0 1px 0 rgba(255,255,255,0.35)',
    };
  } else if (variant === 'ghost') {
    variantClasses = 'border border-transparent hover:bg-black/5 dark:hover:bg-white/5';
    variantStyle = {color: 'var(--sub)'};
  } else if (variant === 'danger') {
    variantClasses = 'border';
    variantStyle = {
      backgroundColor: 'var(--err-bg)',
      borderColor: 'var(--err)',
      color: 'var(--err)',
    };
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      className={`lg-press inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${BTN_SIZE_MAP[size]} ${variantClasses} ${className}`}
      style={{...variantStyle, ...style}}
      {...rest}
    >
      {children}
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* GlassInput / GlassTextarea / GlassSelect                                   */
/* -------------------------------------------------------------------------- */
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leadingIcon?: React.ReactNode;
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({label, leadingIcon, className = '', id, ...rest}, ref) => {
    const inputId =
      id || (label ? `lg-input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium pl-1"
            style={{color: 'var(--sub)'}}
          >
            {label}
          </label>
        )}
        <div
          className={`lg-surface-subtle flex items-center gap-2.5 px-3.5 rounded-[16px] min-h-[48px] transition-shadow focus-within:ring-2 focus-within:ring-[var(--main)] ${className}`}
        >
          {leadingIcon && (
            <span className="shrink-0" style={{color: 'var(--sub)'}}>
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className="w-full bg-transparent text-sm sm:text-[15px] py-2.5 focus:outline-none placeholder:opacity-60"
            style={{color: 'var(--tx)'}}
            {...rest}
          />
        </div>
      </div>
    );
  }
);
GlassInput.displayName = 'GlassInput';

interface GlassTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const GlassTextarea = React.forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({label, className = '', id, ...rest}, ref) => {
    const areaId =
      id || (label ? `lg-area-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label
            htmlFor={areaId}
            className="block text-xs font-medium pl-1"
            style={{color: 'var(--sub)'}}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={`lg-surface-subtle w-full rounded-[16px] p-3.5 text-sm sm:text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--main)] resize-none placeholder:opacity-60 ${className}`}
          style={{color: 'var(--tx)'}}
          {...rest}
        />
      </div>
    );
  }
);
GlassTextarea.displayName = 'GlassTextarea';

interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const GlassSelect: React.FC<GlassSelectProps> = ({
  label,
  className = '',
  children,
  ...rest
}) => (
  <select
    aria-label={label}
    className={`lg-surface-subtle min-h-[44px] px-3.5 py-2 rounded-[14px] text-xs sm:text-sm font-medium focus:outline-none cursor-pointer max-w-full ${className}`}
    style={{color: 'var(--tx)'}}
    {...rest}
  >
    {children}
  </select>
);

/* -------------------------------------------------------------------------- */
/* GlassToggle                                                                */
/* -------------------------------------------------------------------------- */
interface GlassToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}

export const GlassToggle: React.FC<GlassToggleProps> = ({
  checked,
  onChange,
  label,
  description,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => {
      void triggerLightHaptic();
      onChange(!checked);
    }}
    className="w-full min-h-[52px] flex items-center justify-between gap-4 py-2 text-left cursor-pointer lg-press"
  >
    <div className="min-w-0">
      <div className="text-sm font-semibold" style={{color: 'var(--tx)'}}>
        {label}
      </div>
      {description && (
        <div className="text-xs mt-0.5" style={{color: 'var(--sub)'}}>
          {description}
        </div>
      )}
    </div>
    <span
      aria-hidden="true"
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 border"
      style={{
        backgroundColor: checked ? 'var(--main)' : 'var(--glass-subtle)',
        borderColor: checked ? 'var(--main)' : 'var(--border)',
      }}
    >
      <span
        className={`inline-block h-5.5 w-5.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

/* -------------------------------------------------------------------------- */
/* GlassSegmentedControl                                                      */
/* -------------------------------------------------------------------------- */
interface SegmentedOption<T extends string> {
  id: T;
  label: string;
}

interface GlassSegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function GlassSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: GlassSegmentedControlProps<T>) {
  return (
    <div
      className={`lg-surface-subtle p-1 rounded-[16px] inline-flex items-center gap-1 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              onChange(opt.id);
            }}
            className={`lg-press min-h-[42px] px-3.5 rounded-[12px] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              active ? 'lg-surface-strong shadow-sm' : ''
            }`}
            style={{
              color: active ? 'var(--main)' : 'var(--sub)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* GlassAvatar                                                                */
/* -------------------------------------------------------------------------- */
interface GlassAvatarProps {
  name: string;
  gradientId?: string;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const GlassAvatar: React.FC<GlassAvatarProps> = ({
  name,
  gradientId = 'periwinkle',
  size = 'md',
}) => {
  const preset =
    AVATAR_GRADIENTS.find((g) => g.id === gradientId) ?? AVATAR_GRADIENTS[0];

  const sizeClass =
    size === 'sm'
      ? 'w-9 h-9 text-xs'
      : size === 'lg'
      ? 'w-16 h-16 text-xl'
      : 'w-11 h-11 text-sm';

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none`}
      style={{
        background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 6px 16px -4px rgba(79, 109, 245, 0.35)',
      }}
    >
      {getInitials(name)}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* GlassBadge                                                                 */
/* -------------------------------------------------------------------------- */
interface GlassBadgeProps {
  tone?: 'accent' | 'success' | 'danger' | 'neutral';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  tone = 'accent',
  icon,
  children,
}) => {
  const styleMap: Record<NonNullable<GlassBadgeProps['tone']>, React.CSSProperties> = {
    accent: {backgroundColor: 'var(--accent-soft)', color: 'var(--main)'},
    success: {backgroundColor: 'var(--up-bg)', color: 'var(--up)'},
    danger: {backgroundColor: 'var(--err-bg)', color: 'var(--err)'},
    neutral: {backgroundColor: 'var(--glass-subtle)', color: 'var(--sub)'},
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-xs font-semibold whitespace-nowrap shrink-0"
      style={styleMap[tone]}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* GlassListRow                                                               */
/* -------------------------------------------------------------------------- */
interface GlassListRowProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
}

export const GlassListRow: React.FC<GlassListRowProps> = ({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
}) => {
  const content = (
    <>
      {icon && (
        <div
          className="w-10 h-10 rounded-[14px] lg-surface-subtle flex items-center justify-center shrink-0"
          style={{color: 'var(--main)'}}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-semibold truncate" style={{color: 'var(--tx)'}}>
          {title}
        </div>
        {subtitle && (
          <div className="text-xs truncate mt-0.5" style={{color: 'var(--sub)'}}>
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0 flex items-center gap-1.5">{trailing}</div>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          void triggerLightHaptic();
          onClick();
        }}
        className="w-full min-h-[60px] py-2.5 px-2 -mx-2 rounded-[16px] flex items-center gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] lg-press cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="min-h-[60px] py-2.5 flex items-center gap-3">
      {content}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* GlassEmptyState                                                            */
/* -------------------------------------------------------------------------- */
interface GlassEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const GlassEmptyState: React.FC<GlassEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => (
  <div className="py-10 px-4 text-center flex flex-col items-center justify-center space-y-3">
    <div
      className="w-14 h-14 rounded-[20px] lg-surface-strong flex items-center justify-center"
      style={{color: 'var(--main)'}}
    >
      <Icon className="w-6 h-6" />
    </div>
    <div className="space-y-1 max-w-sm">
      <h3 className="text-sm sm:text-base font-semibold" style={{color: 'var(--tx)'}}>
        {title}
      </h3>
      <p className="text-xs sm:text-sm leading-relaxed" style={{color: 'var(--sub)'}}>
        {description}
      </p>
    </div>
    {action && <div className="pt-1">{action}</div>}
  </div>
);

/* -------------------------------------------------------------------------- */
/* GlassSkeleton                                                              */
/* -------------------------------------------------------------------------- */
interface GlassSkeletonProps {
  className?: string;
}

export const GlassSkeleton: React.FC<GlassSkeletonProps> = ({className = 'h-4 w-full'}) => (
  <div aria-hidden="true" className={`lg-skeleton rounded-[12px] ${className}`} />
);

/* -------------------------------------------------------------------------- */
/* GlassModal                                                                 */
/* -------------------------------------------------------------------------- */
interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  maxWidthClass?: string;
  fullHeightOnMobile?: boolean;
  children: React.ReactNode;
}

export const GlassModal: React.FC<GlassModalProps> = ({
  open,
  onClose,
  title,
  icon,
  maxWidthClass = 'sm:max-w-lg',
  fullHeightOnMobile = false,
  children,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/35 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`lg-surface-strong w-full ${maxWidthClass} ${
          fullHeightOnMobile ? 'h-[86dvh] sm:h-[80dvh]' : 'max-h-[88dvh]'
        } rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 flex flex-col overflow-hidden lg-page-enter`}
        style={{color: 'var(--tx)'}}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-10 h-1.5 rounded-full mx-auto mb-3 sm:hidden shrink-0"
          style={{backgroundColor: 'var(--sub)', opacity: 0.35}}
        />
        <div
          className="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b shrink-0"
          style={{borderColor: 'var(--border)'}}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <span style={{color: 'var(--main)'}}>{icon}</span>}
            <h2 className="text-base sm:text-lg font-bold truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              onClose();
            }}
            aria-label="Fermer"
            className="lg-surface-subtle lg-press min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shrink-0 cursor-pointer"
            style={{color: 'var(--sub)'}}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
