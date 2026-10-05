import React, { useId } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label: React.FC<LabelProps> = ({ children, required, className, ...props }) => (
  <label
    className={twMerge(
      clsx('block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5', className)
    )}
    {...props}
  >
    {children}
    {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
  </label>
);

export interface FieldErrorProps {
  id?: string;
  error?: string;
  className?: string;
}

export const FieldError: React.FC<FieldErrorProps> = ({ id, error, className }) => {
  if (!error) return null;
  return (
    <p
      id={id}
      role="alert"
      className={twMerge(clsx('text-xs text-red-600 mt-1 font-medium flex items-center gap-1', className))}
    >
      {error}
    </p>
  );
};

export interface HelpTextProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export const HelpText: React.FC<HelpTextProps> = ({ id, children, className }) => (
  <p id={id} className={twMerge(clsx('text-xs text-slate-500 mt-1', className))}>
    {children}
  </p>
);

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, id: customId, required, className, ...props }, ref) => {
    const generatedId = useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;
    const helpId = `${id}-help`;

    const describedBy = [
      error ? errorId : null,
      helpText ? helpId : null,
    ].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <Label htmlFor={id} required={required}>
            {label}
          </Label>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={twMerge(
            clsx(
              'w-full px-3.5 py-2 text-sm text-slate-900 bg-white rounded-lg border motion-safe:transition-colors',
              'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1',
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-400 bg-red-50/20'
                : 'border-slate-300 hover:border-slate-400 focus:border-indigo-600 focus:ring-indigo-500',
              className
            )
          )}
          {...props}
        />
        <FieldError id={errorId} error={error} />
        {helpText && !error && <HelpText id={helpId}>{helpText}</HelpText>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helpText, id: customId, required, className, children, ...props }, ref) => {
    const generatedId = useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;
    const helpId = `${id}-help`;

    const describedBy = [
      error ? errorId : null,
      helpText ? helpId : null,
    ].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <Label htmlFor={id} required={required}>
            {label}
          </Label>
        )}
        <select
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={twMerge(
            clsx(
              'w-full px-3.5 py-2 text-sm text-slate-900 bg-white rounded-lg border motion-safe:transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-400'
                : 'border-slate-300 hover:border-slate-400 focus:border-indigo-600 focus:ring-indigo-500',
              className
            )
          )}
          {...props}
        >
          {children}
        </select>
        <FieldError id={errorId} error={error} />
        {helpText && !error && <HelpText id={helpId}>{helpText}</HelpText>}
      </div>
    );
  }
);
Select.displayName = 'Select';
