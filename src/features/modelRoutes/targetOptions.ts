import { normalizeProviderKey } from '@/features/authFiles/constants';
import type { AuthFileItem } from '@/types';

export interface ModelTargetSource {
  provider: string;
  models: ReadonlyArray<string | null | undefined>;
}

export interface ModelTargetOption {
  value: string;
  label: string;
}

const AUTH_FILE_PROVIDER_EXCLUDES = new Set(['all', 'empty', 'unknown']);

const modelKey = (model: string): string => model.trim().toLowerCase();

const normalizeAuthFileProviderKey = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const key = normalizeProviderKey(value);
  if (!key || AUTH_FILE_PROVIDER_EXCLUDES.has(key)) return '';
  return key;
};

export const getAuthFileProviderKey = (file: AuthFileItem): string => {
  const typeKey = normalizeAuthFileProviderKey(file.type);
  if (typeKey) return typeKey;
  return normalizeAuthFileProviderKey(file.provider);
};

export const collectAuthFileProviderKeys = (files: ReadonlyArray<AuthFileItem>): string[] => {
  const providers = new Set<string>();

  files.forEach((file) => {
    [file.type, file.provider].forEach((value) => {
      const key = normalizeAuthFileProviderKey(value);
      if (!key) return;
      providers.add(key);
    });
  });

  return Array.from(providers).sort((a, b) => a.localeCompare(b));
};

export const buildModelTargetOptions = (
  sources: ReadonlyArray<ModelTargetSource>,
  savedModels: ReadonlyArray<string | null | undefined>,
  savedProviderLabel: string
): ModelTargetOption[] => {
  const providersByModel = new Map<string, { value: string; providers: Set<string> }>();

  const addModel = (provider: string, model: string | null | undefined) => {
    const providerLabel = provider.trim();
    const value = model?.trim();
    if (!providerLabel || !value) return;

    const key = modelKey(value);
    const entry = providersByModel.get(key) ?? { value, providers: new Set<string>() };
    entry.providers.add(providerLabel);
    providersByModel.set(key, entry);
  };

  sources.forEach((source) => {
    source.models.forEach((model) => addModel(source.provider, model));
  });

  savedModels.forEach((model) => {
    const value = model?.trim();
    if (!value) return;
    if (!providersByModel.has(modelKey(value))) {
      addModel(savedProviderLabel, value);
    }
  });

  return Array.from(providersByModel.values())
    .map((entry) => ({
      value: entry.value,
      label: `${Array.from(entry.providers).sort().join(', ')} - ${entry.value}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};
