import { Control, Controller, FieldPath, RegisterOptions } from "react-hook-form";
import { Checkbox, Input, Select, Textarea } from "@libretexts/davis-react";
import type { SelectOption } from "@libretexts/davis-react";
import { Project } from "../../../types";

/**
 * Davis inputs bound to the properties form. Each one shows its own
 * validation message, and `value ?? ""` keeps fields the project lacks controlled.
 */

type BaseFieldProps = {
  control: Control<Project>;
  name: FieldPath<Project>;
  label: string;
  helperText?: string;
  rules?: RegisterOptions<Project, FieldPath<Project>>;
  className?: string;
};

export const TextField = ({
  control,
  name,
  label,
  helperText,
  rules,
  className,
  type = "text",
  placeholder,
  required,
}: BaseFieldProps & { type?: "text" | "url" | "email"; placeholder?: string; required?: boolean }) => (
  <Controller
    control={control}
    name={name}
    rules={rules}
    render={({ field, fieldState }) => (
      <Input
        ref={field.ref}
        name={field.name}
        label={label}
        type={type}
        placeholder={placeholder}
        required={required}
        helperText={helperText}
        error={!!fieldState.error}
        errorMessage={fieldState.error?.message}
        value={(field.value as string | undefined) ?? ""}
        onChange={field.onChange}
        onBlur={field.onBlur}
        className={className}
      />
    )}
  />
);

export const TextAreaField = ({
  control,
  name,
  label,
  helperText,
  rules,
  className,
  placeholder,
  rows = 3,
  maxLength,
}: BaseFieldProps & { placeholder?: string; rows?: number; maxLength?: number }) => (
  <Controller
    control={control}
    name={name}
    rules={rules}
    render={({ field, fieldState }) => (
      <Textarea
        ref={field.ref}
        name={field.name}
        label={label}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        showCharacterCount={maxLength !== undefined}
        helperText={helperText}
        error={!!fieldState.error}
        errorMessage={fieldState.error?.message}
        value={(field.value as string | undefined) ?? ""}
        onChange={field.onChange}
        onBlur={field.onBlur}
        className={className}
      />
    )}
  />
);

export const SelectField = ({
  control,
  name,
  label,
  helperText,
  rules,
  className,
  options,
  placeholder,
  required,
  defaultValue = "",
  onValueChange,
}: BaseFieldProps & {
  options: SelectOption[];
  placeholder: string;
  required?: boolean;
  /** Shown when the project has no value, e.g. "all" for notifications. */
  defaultValue?: string;
  /** Runs after the user picks a value, for dependent fields. */
  onValueChange?: (value: string) => void;
}) => (
  <Controller
    control={control}
    name={name}
    rules={rules}
    render={({ field, fieldState }) => (
      <Select
        ref={field.ref}
        name={field.name}
        label={label}
        placeholder={placeholder}
        options={options}
        required={required}
        helperText={helperText}
        error={!!fieldState.error}
        errorMessage={fieldState.error?.message}
        value={(field.value as string | undefined) || defaultValue}
        onChange={(e) => {
          field.onChange(e.target.value);
          onValueChange?.(e.target.value);
        }}
        onBlur={field.onBlur}
        className={className}
      />
    )}
  />
);

/** The server returns ISO timestamps. A cleared field sends "", which unsets it. */
const toDateInputValue = (value: unknown): string => {
  if (!value) return "";
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

export const DateField = ({ control, name, label, helperText, className }: BaseFieldProps) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <Input
        ref={field.ref}
        name={field.name}
        label={label}
        type="date"
        helperText={helperText}
        value={toDateInputValue(field.value)}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        className={className}
      />
    )}
  />
);

export const CheckboxField = ({
  control,
  name,
  label,
  className,
  description,
}: Omit<BaseFieldProps, "helperText" | "rules"> & { description?: string }) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <Checkbox
        name={field.name}
        label={label}
        description={description}
        checked={!!field.value}
        onChange={(checked) => field.onChange(checked)}
        className={className}
      />
    )}
  />
);
