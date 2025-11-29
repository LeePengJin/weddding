import React from 'react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  style = {},
  disabled = false,
  ...props
}) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    transition: 'background-color 0.25s ease, color 0.25s ease, transform 0.2s ease',
    fontWeight: 600,
    fontFamily: "'Literata', serif",
    outline: 'none',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };

  const variantStyles = {
    primary: {
      backgroundColor: '#f43f5e',
      color: '#fff',
    },
    secondary: {
      backgroundColor: '#fff',
      color: '#9f1239',
      border: '1px solid rgba(244, 63, 94, 0.2)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#f43f5e',
      border: '2px solid #f43f5e',
    },
  };

  const sizeStyles = {
    sm: { padding: '8px 18px', fontSize: '0.9rem' },
    md: { padding: '12px 26px', fontSize: '1rem' },
    lg: { padding: '16px 36px', fontSize: '1.1rem' },
  };

  const hoverStyles = !disabled
    ? {
        primary: { backgroundColor: '#e11d48' },
        secondary: { backgroundColor: '#fff5f7' },
        outline: { backgroundColor: 'rgba(244, 63, 94, 0.08)' },
      }
    : {};

  const combinedStyles = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  return (
    <button
      className={className}
      style={combinedStyles}
      onMouseEnter={(e) => {
        if (disabled || !hoverStyles[variant]) return;
        Object.assign(e.currentTarget.style, hoverStyles[variant]);
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        Object.assign(e.currentTarget.style, {
          backgroundColor: variantStyles[variant].backgroundColor || 'transparent',
        });
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
