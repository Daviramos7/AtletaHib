const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const MAX_JSON_CHARS = 1_000_000;
const MAX_DEPTH = 12;
const MAX_ARRAY_ITEMS = 250;
const MAX_OBJECT_KEYS = 120;
const MAX_TOTAL_NODES = 5_000;
const MAX_STRING_CHARS = 20_000;

export function parseImportJson(text: string) {
  if (text.length > MAX_JSON_CHARS) {
    throw new Error('JSON muito grande. Reduza o arquivo antes de importar.');
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('JSON inválido. Verifique vírgulas, aspas e chaves. Dica: cole exatamente o JSON puro retornado pelo leitor.');
  }

  return assertSafeImportPayload(value);
}

export function assertSafeImportPayload<T>(value: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('JSON inválido: a raiz precisa ser um objeto.');
  }

  let nodes = 0;
  const visit = (current: unknown, depth: number) => {
    nodes += 1;
    if (nodes > MAX_TOTAL_NODES) throw new Error('JSON complexo demais para importação.');
    if (depth > MAX_DEPTH) throw new Error('JSON com níveis demais para importação.');

    if (typeof current === 'string') {
      if (current.length > MAX_STRING_CHARS) throw new Error('JSON contém texto longo demais.');
      return;
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new Error('JSON contém número inválido.');
      return;
    }
    if (current === null || typeof current !== 'object') return;

    if (Array.isArray(current)) {
      if (current.length > MAX_ARRAY_ITEMS) throw new Error(`JSON contém uma lista com mais de ${MAX_ARRAY_ITEMS} itens.`);
      current.forEach((item) => visit(item, depth + 1));
      return;
    }

    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('JSON contém um objeto não suportado.');
    }

    const keys = Object.keys(current);
    if (keys.length > MAX_OBJECT_KEYS) throw new Error('JSON contém campos demais em um único objeto.');
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) throw new Error(`JSON contém o campo inseguro "${key}".`);
      visit((current as Record<string, unknown>)[key], depth + 1);
    }
  };

  visit(value, 0);
  return value;
}

export function boundedNumber(value: unknown, label: string, min: number, max: number) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label} fora do intervalo aceito (${min} a ${max}).`);
  }
  return number;
}

export function boundedInteger(value: unknown, label: string, min: number, max: number) {
  const number = boundedNumber(value, label, min, max);
  return number === null ? null : Math.round(number);
}

export function boundedText(value: unknown, label: string, max = 500) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (text.length > max) throw new Error(`${label} longo demais (máximo de ${max} caracteres).`);
  return text;
}

export function assertReasonableImportDate(dateKey: string, label = 'Data') {
  const parsed = new Date(`${dateKey}T12:00:00Z`);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() < 2000 || parsed > tomorrow) {
    throw new Error(`${label} fora do intervalo aceito.`);
  }
  return dateKey;
}

export function assertImportDateValue(value: unknown, label = 'Data') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error(`${label} inválida. Use exatamente YYYY-MM-DD.`);
  }
  return value.trim();
}

export function assertImportTimeValue(value: unknown, label = 'Horário') {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{1,2}[:hH]\d{2}$/.test(value.trim())) {
    throw new Error(`${label} inválido. Use exatamente HH:mm.`);
  }
  return value.trim();
}
