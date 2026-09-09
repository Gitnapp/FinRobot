"use client";
import { type ComponentProps, type ReactNode, useState } from "react";
import { Input } from "./input";

export function EditableValue({
  value,
  displayValue,
  label,
  onCommit,
  disabled,
  inputProps,
}: {
  value: string | number;
  displayValue?: ReactNode;
  label: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  inputProps?: Omit<
    ComponentProps<typeof Input>,
    "value" | "defaultValue" | "onChange" | "onBlur" | "onKeyDown" | "autoFocus"
  >;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  return editing ? (
    <Input
      data-rui-editable="true"
      {...inputProps}
      autoFocus
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        if (e.currentTarget.checkValidity()) onCommit(draft);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
      }}
    />
  ) : (
    <button
      type="button"
      className="rui-editable-value"
      aria-label={`编辑${label}`}
      disabled={disabled}
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    >
      {displayValue ?? value}
    </button>
  );
}
