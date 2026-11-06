"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id: string;
  name?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  id,
  name,
  value,
  options,
  onChange,
  placeholder = "ค้นหาและเลือก…",
  emptyMessage = "ไม่พบรายการที่ค้นหา",
  disabled = false,
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    if (!normalized || selectedOption?.label === query) return options;
    return options.filter((option) => option.label.toLocaleLowerCase("th").includes(normalized));
  }, [options, query, selectedOption?.label]);

  useEffect(() => {
    if (!open) setQuery(selectedOption?.label ?? "");
  }, [open, selectedOption?.label]);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  function openList() {
    if (disabled) return;
    setOpen(true);
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value && !option.disabled);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, filteredOptions.findIndex((option) => !option.disabled)));
  }

  function selectOption(option: SearchableSelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  function moveActive(direction: 1 | -1) {
    if (!filteredOptions.length) return;
    let next = activeIndex;
    for (let step = 0; step < filteredOptions.length; step += 1) {
      next = (next + direction + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[next]?.disabled) {
        setActiveIndex(next);
        return;
      }
    }
  }

  return <div className={`searchable-select${disabled ? " is-disabled" : ""}`} ref={rootRef}>
    {name ? <input type="hidden" name={name} value={value} /> : null}
    <input
      id={id}
      className="searchable-select-input"
      type="text"
      role="combobox"
      aria-autocomplete="list"
      aria-controls={listboxId}
      aria-expanded={open}
      aria-activedescendant={open && filteredOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
      autoComplete="off"
      value={query}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={openList}
      onClick={openList}
      onChange={(event) => {
        setQuery(event.target.value);
        if (value) onChange("");
        setOpen(true);
        setActiveIndex(0);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (!open) openList(); else moveActive(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) openList(); else moveActive(-1);
        } else if (event.key === "Enter" && open) {
          event.preventDefault();
          const option = filteredOptions[activeIndex];
          if (option) selectOption(option);
        } else if (event.key === "Escape") {
          setOpen(false);
          setQuery(selectedOption?.label ?? "");
        } else if (event.key === "Tab") {
          setOpen(false);
        }
      }}
    />
    <button
      type="button"
      className="searchable-select-toggle"
      aria-label={open ? "ปิดรายการ" : "เปิดรายการ"}
      aria-expanded={open}
      disabled={disabled}
      onClick={() => open ? setOpen(false) : openList()}
    >
      <span className="searchable-select-chevron" aria-hidden="true" />
    </button>
    {open ? <div className="searchable-select-menu" id={listboxId} role="listbox">
      {filteredOptions.length ? filteredOptions.map((option, index) => <button
        type="button"
        id={`${id}-option-${index}`}
        className={`searchable-select-option${index === activeIndex ? " is-active" : ""}`}
        role="option"
        aria-selected={option.value === value}
        disabled={option.disabled}
        key={option.value || "empty"}
        onMouseEnter={() => setActiveIndex(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => selectOption(option)}
      >
        <span>{option.label}</span>
        {option.value === value ? <span className="searchable-select-check" aria-hidden="true">✓</span> : null}
      </button>) : <div className="searchable-select-empty">{emptyMessage}</div>}
    </div> : null}
  </div>;
}
