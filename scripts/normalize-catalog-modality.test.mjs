import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCatalogModality } from './normalize-catalog-modality.mjs';

test('normalizes transcription aliases to the canonical audio_stt modality', () => {
  assert.equal(normalizeCatalogModality('transcription'), 'audio_stt');
  assert.equal(normalizeCatalogModality('speech-to-text'), 'audio_stt');
  assert.equal(normalizeCatalogModality('audio_stt'), 'audio_stt');
});

test('preserves already canonical non-transcription modalities', () => {
  assert.equal(normalizeCatalogModality('audio'), 'audio');
  assert.equal(normalizeCatalogModality('text'), 'text');
  assert.equal(normalizeCatalogModality('image'), 'image');
});
