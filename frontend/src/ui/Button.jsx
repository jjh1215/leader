// Shared button look for the whole app -- a plain unstyled <button> reads as
// a bare OS control and looks inconsistent next to the toolbar's icon
// buttons, so every button in the app (aside from the toolbar's own
// ToolButton, which adds an active/pressed state on top of this) goes
// through this component instead.
const base = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.4rem 0.75rem',
  border: '1px solid #d6d6d6',
  borderRadius: 6,
  background: '#fff',
  color: '#333',
  fontSize: '0.85rem',
  lineHeight: 1,
  cursor: 'pointer',
}

const variants = {
  default: {},
  primary: { background: '#1e6fe0', borderColor: '#1e6fe0', color: '#fff' },
  danger: { background: '#fff', borderColor: '#e0781e', color: '#c0442a' },
}

function Button({ icon, children, variant = 'default', disabled, style, ...rest }) {
  return (
    <button
      disabled={disabled}
      style={{
        ...base,
        ...variants[variant],
        ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}),
        ...style,
      }}
      {...rest}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}

export default Button
