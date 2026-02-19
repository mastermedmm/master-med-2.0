import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========== Brasília Timezone Helpers ==========

/**
 * Retorna a data/hora atual no timezone de Brasília como ISO string
 */
export function nowBrasilia(): string {
  return new Date().toLocaleString('sv-SE', { 
    timeZone: 'America/Sao_Paulo' 
  }).replace(' ', 'T') + '.000Z';
}

/**
 * Retorna apenas a data atual em Brasília (yyyy-mm-dd)
 */
export function todayBrasilia(): string {
  return new Date().toLocaleDateString('sv-SE', { 
    timeZone: 'America/Sao_Paulo' 
  });
}

/**
 * Converte qualquer Date para ISO string no timezone de Brasília
 */
export function toBrasiliaISO(date: Date): string {
  return date.toLocaleString('sv-SE', { 
    timeZone: 'America/Sao_Paulo' 
  }).replace(' ', 'T') + '.000Z';
}

/**
 * Converte Date para data apenas (yyyy-mm-dd) no timezone de Brasília
 */
export function toBrasiliaDate(date: Date): string {
  return date.toLocaleDateString('sv-SE', { 
    timeZone: 'America/Sao_Paulo' 
  });
}

/**
 * Formata uma string de data (YYYY-MM-DD ou ISO) para exibição em pt-BR (dd/mm/yyyy)
 * Evita problema de timezone onde new Date('2026-01-14') pode ser interpretado como UTC
 * e ao converter para local pode mostrar o dia anterior
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  
  // Se for string com formato YYYY-MM-DD, extrair partes diretamente
  const datePart = dateStr.split('T')[0];
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  
  // Fallback para outros formatos
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Formata uma string de data/hora (ISO) para exibição em pt-BR com hora
 */
export function formatDateTimeBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
