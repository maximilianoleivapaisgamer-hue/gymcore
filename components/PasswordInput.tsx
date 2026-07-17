"use client";

import { useState } from "react";

/**
 * Campo de contraseña con "ojito" para mostrar/ocultar lo que se escribe.
 * Usa el mismo estilo que `.input` del resto de la app. Es controlado:
 * pasale `value` y `onChange` igual que a un <input> normal.
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder = "Contraseña",
  required = false,
  autoComplete,
  name,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  name?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className={`input pr-11 ${className}`}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        name={name}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        title={show ? "Ocultar" : "Mostrar"}
        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-2 transition hover:text-ink"
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 .9-.6 2.1-1.7 3.3M6.3 6.3C3.9 7.7 2 10.2 2 12c0 2 4 7 10 7 1.4 0 2.7-.3 3.8-.7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
