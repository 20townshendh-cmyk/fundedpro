"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  label: string;
  value: string;
};

export function SearchableSelect({
  name,
  options,
  placeholder,
  searchPlaceholder,
  defaultValue = "",
  hasError = false
}: {
  name: string;
  options: Option[];
  placeholder: string;
  searchPlaceholder: string;
  defaultValue?: string;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === selectedValue);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }

    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    setSelectedValue(defaultValue);
  }, [defaultValue]);

  return (
    <div className={`searchable-select${open ? " open" : ""}${hasError ? " has-error" : ""}`} ref={rootRef}>
      <input type="hidden" name={name} value={selectedValue} />
      <button
        type="button"
        className="searchable-select-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selected?.label ?? placeholder}</span>
        <span className="searchable-select-chevron">v</span>
      </button>
      {open ? (
        <div className="searchable-select-popover">
          <input
            autoFocus
            className="searchable-select-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <div className="searchable-select-list">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`searchable-select-option${option.value === selectedValue ? " active" : ""}`}
                onClick={() => {
                  setSelectedValue(option.value);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
