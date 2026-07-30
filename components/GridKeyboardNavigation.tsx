'use client';

import { useEffect } from 'react';

const teclasNavegacion = new Set([
  'Enter',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

function esCasillaEditable(elemento: Element | null): elemento is HTMLInputElement {
  if (!(elemento instanceof HTMLInputElement)) return false;
  if (elemento.disabled || elemento.readOnly) return false;
  if (elemento.dataset.gridNavigation === 'off') return false;

  return !['button', 'checkbox', 'file', 'hidden', 'radio', 'reset', 'submit'].includes(
    elemento.type
  );
}

function entradasFila(fila: HTMLTableRowElement) {
  return Array.from(fila.querySelectorAll('input')).filter(esCasillaEditable);
}

function entradaVertical(
  filaOrigen: HTMLTableRowElement,
  direccion: -1 | 1,
  columna: number
) {
  let fila: Element | null =
    direccion < 0
      ? filaOrigen.previousElementSibling
      : filaOrigen.nextElementSibling;

  while (fila instanceof HTMLTableRowElement) {
    const celda = Array.from(fila.cells).find(
      (item) =>
        item.cellIndex <= columna &&
        item.cellIndex + Math.max(1, item.colSpan) > columna
    );
    const entrada = Array.from(celda?.querySelectorAll('input') || []).find(
      esCasillaEditable
    );
    if (entrada) return entrada;

    fila =
      direccion < 0 ? fila.previousElementSibling : fila.nextElementSibling;
  }

  return null;
}

export function GridKeyboardNavigation() {
  useEffect(() => {
    function navegar(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !teclasNavegacion.has(event.key) ||
        !esCasillaEditable(event.target as Element | null)
      ) {
        return;
      }

      const entrada = event.target as HTMLInputElement;
      const fila = entrada.closest('tr');
      const celda = entrada.closest('td,th');
      if (
        !(fila instanceof HTMLTableRowElement) ||
        !(celda instanceof HTMLTableCellElement) ||
        !entrada.closest('table')
      ) {
        return;
      }

      let siguiente: HTMLInputElement | null = null;

      if (
        event.key === 'Enter' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown'
      ) {
        const direccion: -1 | 1 =
          event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey)
            ? -1
            : 1;
        siguiente = entradaVertical(fila, direccion, celda.cellIndex);
      } else {
        const entradas = entradasFila(fila);
        const indice = entradas.indexOf(entrada);
        siguiente =
          entradas[indice + (event.key === 'ArrowLeft' ? -1 : 1)] || null;
      }

      if (!siguiente) return;
      event.preventDefault();
      siguiente.focus();
      siguiente.select();
    }

    document.addEventListener('keydown', navegar);
    return () => document.removeEventListener('keydown', navegar);
  }, []);

  return null;
}
