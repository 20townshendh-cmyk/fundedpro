"use client";

import { useEffect, useState } from "react";

export function DateInput({
  name,
  defaultValue = "",
  hasError = false
}: {
  name: string;
  defaultValue?: string;
  hasError?: boolean;
}) {
  const [value, setValue] = useState(formatDate(defaultValue));

  useEffect(() => {
    setValue(formatDate(defaultValue));
  }, [defaultValue]);

  return (
    <input
      name={name}
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      maxLength={10}
      value={value}
      className={hasError ? "signup-input-error" : ""}
      onChange={(event) => setValue(formatDate(event.target.value))}
    />
  );
}

function formatDate(input: string) {
  const rawDigits = input.replace(/\D/g, "").slice(0, 8);

  if (rawDigits.length <= 2) {
    return clampDay(rawDigits);
  }

  const day = clampDay(rawDigits.slice(0, 2));
  const remainingAfterDay = rawDigits.slice(day.length);

  if (remainingAfterDay.length <= 2) {
    const month = clampMonth(remainingAfterDay);
    return [day, month].filter(Boolean).join("/");
  }

  const month = clampMonth(remainingAfterDay.slice(0, 2));
  const year = remainingAfterDay.slice(month.length, month.length + 4);

  return [day, month, year].filter(Boolean).join("/");
}

function clampDay(value: string) {
  if (!value) {
    return "";
  }

  if (value.length === 1) {
    const digit = Number(value);
    return digit > 3 ? `0${digit}` : value;
  }

  const day = Number(value.slice(0, 2));
  return String(Math.min(Math.max(day, 1), 31)).padStart(2, "0");
}

function clampMonth(value: string) {
  if (!value) {
    return "";
  }

  if (value.length === 1) {
    const digit = Number(value);
    return digit > 1 ? `0${digit}` : value;
  }

  const month = Number(value.slice(0, 2));
  return String(Math.min(Math.max(month, 1), 12)).padStart(2, "0");
}
