export type PhoneEntry = { name: string; number: string };

export function parsePhones(raw: string): PhoneEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((p: any) => p.number);
  } catch {}
  return [{ name: "", number: raw }];
}

export function serializePhones(phones: PhoneEntry[]): string {
  const filtered = phones.filter(p => p.number.trim());
  if (filtered.length === 0) return "";
  if (filtered.length === 1 && !filtered[0].name) return filtered[0].number;
  return JSON.stringify(filtered);
}

export function getPrimaryPhone(raw: string): string {
  const phones = parsePhones(raw);
  return phones[0]?.number || "";
}

export function getPhoneDisplay(raw: string): string {
  const phones = parsePhones(raw);
  if (phones.length === 0) return "";
  if (phones.length === 1) {
    return phones[0].name ? `${phones[0].number} (${phones[0].name})` : phones[0].number;
  }
  return `${phones[0].number} (+${phones.length - 1})`;
}
