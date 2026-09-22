"use client";

export function formatNairaInput(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-NG");
}

export function parseNairaInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export default function MoneyInput({
  value,
  onChange,
  placeholder,
  required,
  name,
  className,
}: {
  value: string | number | null;
  onChange: (naira: number | null) => void;
  placeholder?: string;
  required?: boolean;
  name?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      name={name}
      required={required}
      placeholder={placeholder}
      className={className}
      value={formatNairaInput(value)}
      onChange={(event) => onChange(parseNairaInput(event.target.value))}
    />
  );
}
