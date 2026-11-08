"use client";

import type { InputHTMLAttributes } from "react";

/**
 * Radio que envía su formulario al elegirlo, para filtros de una sola
 * opción (p. ej. el nivel) que deben buscar sin pulsar "Filtrar".
 */
export function AutoSubmitRadio(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange">
) {
  return (
    <input
      {...props}
      type="radio"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    />
  );
}
