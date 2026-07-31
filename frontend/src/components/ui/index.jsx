// src/components/ui/index.jsx
import { useState } from "react";

// ── Button ────────────────────────────────────────────────────
export function Button({ children, variant = "primary", size = "md", loading, icon, onClick, disabled, style = {}, type = "button" }) {
  const sizes = { sm: "8px 14px", md: "10px 20px", lg: "13px 28px" };
  const fontSize = { sm: 12, md: 13, lg: 14 };

  const variants = {
    primary:  { background: "var(--accent)",  color: "#0d0f14", border: "none" },
    secondary:{ background: "var(--card)",    color: "var(--text)", border: "1px solid var(--border)" },
    danger:   { background: "var(--danger)20",color: "var(--danger)", border: "1px solid var(--danger)40" },
    ghost:    { background: "transparent",    color: "var(--muted-lt)", border: "none" },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...variants[variant],
        padding: sizes[size],
        fontSize: fontSize[size],
        fontWeight: 600,
        borderRadius: "var(--radius-sm)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, error, icon, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        {icon && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 15 }}>
            {icon}
          </span>
        )}
        <input
          {...props}
          style={{
            width: "100%",
            padding: icon ? "10px 38px 10px 14px" : "10px 14px",
            background: "var(--surface)",
            border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            fontSize: 13,
            outline: "none",
            transition: "border-color 0.15s",
            textAlign: "right",
            direction: "rtl",
            ...props.style,
          }}
          onFocus={e => e.target.style.borderColor = "var(--accent2)"}
          onBlur={e => e.target.style.borderColor = error ? "var(--danger)" : "var(--border)"}
        />
      </div>
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────
export function Select({ label, error, options = [], ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 12, color: "var(--muted-lt)", fontWeight: 500 }}>{label}</label>}
      <select
        {...props}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: "var(--surface)",
          border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
          borderRadius: "var(--radius-sm)",
          color: "var(--text)",
          fontSize: 13,
          outline: "none",
          cursor: "pointer",
          direction: "rtl",
          ...props.style,
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
const BADGE_COLORS = {
  active:   { bg: "#6ee7b720", color: "#6ee7b7" },
  expiring: { bg: "#fbbf2420", color: "#fbbf24" },
  expired:  { bg: "#f8717120", color: "#f87171" },
  pending:  { bg: "#818cf820", color: "#818cf8" },
  athlete:  { bg: "#0ea5e920", color: "#0ea5e9" },
  guardian: { bg: "#a78bfa20", color: "#a78bfa" },
  coach:    { bg: "#fb923c20", color: "#fb923c" },
};

export function Badge({ label, type = "active" }) {
  const c = BADGE_COLORS[type] || { bg: "var(--border)", color: "var(--muted-lt)" };
  return (
    <span style={{
      fontSize: 11, padding: "3px 10px", borderRadius: 20,
      background: c.bg, color: c.color, fontWeight: 500,
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 20, color = "var(--accent)" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${color}30`,
      borderTopColor: color,
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: 16, animation: "fadeIn 0.2s ease",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 16, width: "100%", maxWidth: width,
        maxHeight: "90vh", overflow: "auto",
        animation: "fadeUp 0.25s ease",
        boxShadow: "var(--shadow)",
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{title}</span>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>
        <div style={{ padding: "22px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
export function Empty({ icon = "📭", title, description }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--muted-lt)", marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13 }}>{description}</div>}
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────
export function Confirm({ open, onClose, onConfirm, title, message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={400}>
      <p style={{ fontSize: 13, color: "var(--muted-lt)", marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>تأكيد الحذف</Button>
      </div>
    </Modal>
  );
}
