"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  name?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        type={visible ? "text" : "password"}
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        name={name}
      />
      <button
        type="button"
        className="password-field-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((open) => !open)}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
