export function normalizeCatalogModality(value) {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[._/-]+/g, ' ');
  if (!normalized) return '';
  if (
    normalized.includes('transcri') ||
    normalized.includes('speech to text') ||
    normalized.includes('stt')
  ) {
    return 'audio_stt';
  }
  return String(value).trim();
}
