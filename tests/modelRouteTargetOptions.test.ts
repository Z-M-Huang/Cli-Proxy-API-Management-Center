import { describe, expect, test } from 'bun:test';
import {
  buildModelTargetOptions,
  collectAuthFileProviderKeys,
  getAuthFileProviderKey,
} from '../src/features/modelRoutes/targetOptions';

describe('model route target options', () => {
  test('collects normalized configured auth-file providers', () => {
    expect(
      collectAuthFileProviderKeys([
        { name: 'one.json', type: 'x-ai' },
        { name: 'two.json', provider: 'anti-gravity' },
        { name: 'three.json', type: 'empty' },
        { name: 'four.json', type: 'unknown' },
        { name: 'five.json', type: 'xai' },
      ])
    ).toEqual(['antigravity', 'xai']);
  });

  test('prefers the primary provider key from an auth file', () => {
    expect(getAuthFileProviderKey({ name: 'one.json', type: 'empty', provider: 'iflow' })).toBe(
      'iflow'
    );
    expect(getAuthFileProviderKey({ name: 'two.json', type: 'x-ai', provider: 'codex' })).toBe(
      'xai'
    );
  });

  test('deduplicates models across provider sources and preserves saved unknown targets', () => {
    const options = buildModelTargetOptions(
      [
        { provider: 'OpenAI #1', models: ['gpt-5.4-mini', 'shared-model'] },
        { provider: 'Codex', models: ['shared-model', 'codex-auto'] },
      ],
      ['legacy-model', 'SHARED-MODEL'],
      'Saved'
    );

    expect(options.find((option) => option.value === 'shared-model')?.label).toBe(
      'Codex, OpenAI #1 - shared-model'
    );
    expect(options.find((option) => option.value === 'legacy-model')?.label).toBe(
      'Saved - legacy-model'
    );
    expect(options.some((option) => option.value === 'SHARED-MODEL')).toBe(false);
  });
});
