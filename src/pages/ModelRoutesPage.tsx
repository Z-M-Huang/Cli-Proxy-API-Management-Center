import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { IconPencil, IconPlus, IconRefreshCw, IconTrash2 } from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import {
  modelRoutesApi,
  MODEL_ROUTE_STRATEGIES,
  type ModelRoute,
} from '@/services/api/modelRoutes';
import { useAuthStore, useNotificationStore } from '@/stores';
import styles from './ModelRoutesPage.module.scss';

const EMPTY_ROUTE: ModelRoute = {
  alias: '',
  strategy: 'priority',
  models: [],
};

interface EditorState {
  open: boolean;
  route: ModelRoute;
  modelUids: string[];
  originalAlias: string | null;
  saving: boolean;
  error: string;
}

let modelUidCounter = 0;
const nextModelUid = (): string => {
  modelUidCounter += 1;
  return `mr${modelUidCounter}`;
};

const buildModelUids = (count: number): string[] =>
  Array.from({ length: count }, () => nextModelUid());

const cloneRoute = (route: ModelRoute): ModelRoute => ({
  ...route,
  models: [...(route.models ?? [])],
});

const trimRoute = (route: ModelRoute): ModelRoute => {
  const clean: ModelRoute = {
    alias: route.alias.trim(),
    strategy: route.strategy || 'priority',
    models: (route.models ?? []).map((model) => model.trim()).filter(Boolean),
  };
  if (route['cooldown-seconds'] !== undefined) {
    clean['cooldown-seconds'] = route['cooldown-seconds'];
  }
  return clean;
};

const hasThinkingSuffix = (model: string): boolean => {
  const trimmed = model.trim();
  const open = trimmed.lastIndexOf('(');
  return open > 0 && trimmed.endsWith(')');
};

const baseModelName = (model: string): string => {
  const trimmed = model.trim();
  const open = trimmed.lastIndexOf('(');
  if (open <= 0 || !trimmed.endsWith(')')) return trimmed;
  return trimmed.slice(0, open).trim();
};

const strategyLabelKey = (strategy: ModelRoute['strategy']): string =>
  strategy === 'round-robin'
    ? 'model_routes.strategy_round_robin'
    : 'model_routes.strategy_priority';

const iconText = (icon: ReactElement, label: string) => (
  <span className={styles.buttonContent}>
    {icon}
    <span>{label}</span>
  </span>
);

export function ModelRoutesPage() {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const disabled = connectionStatus !== 'connected';

  const [routes, setRoutes] = useState<ModelRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    route: cloneRoute(EMPTY_ROUTE),
    modelUids: [],
    originalAlias: null,
    saving: false,
    error: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await modelRoutesApi.list();
      setRoutes(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('model_routes.load_failed');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useHeaderRefresh(load);
  useEffect(() => {
    load().catch(() => {
      // surfaced via state.error
    });
  }, [load]);

  const strategyOptions = useMemo(
    () =>
      MODEL_ROUTE_STRATEGIES.map((strategy) => ({
        value: strategy.value,
        label: t(strategy.labelKey),
      })),
    [t]
  );

  const sortedRoutes = useMemo(
    () => [...routes].sort((a, b) => a.alias.localeCompare(b.alias)),
    [routes]
  );

  const openCreate = useCallback(() => {
    setEditor({
      open: true,
      route: cloneRoute(EMPTY_ROUTE),
      modelUids: [],
      originalAlias: null,
      saving: false,
      error: '',
    });
  }, []);

  const openEdit = useCallback((route: ModelRoute) => {
    setEditor({
      open: true,
      route: cloneRoute(route),
      modelUids: buildModelUids((route.models ?? []).length),
      originalAlias: route.alias,
      saving: false,
      error: '',
    });
  }, []);

  const closeEditor = useCallback(() => {
    setEditor((prev) => ({ ...prev, open: false }));
  }, []);

  const updateRouteField = useCallback(
    <K extends keyof ModelRoute>(key: K, value: ModelRoute[K]) => {
      setEditor((prev) => ({
        ...prev,
        route: { ...prev.route, [key]: value },
        error: '',
      }));
    },
    []
  );

  const addModelEntry = useCallback(() => {
    setEditor((prev) => ({
      ...prev,
      route: { ...prev.route, models: [...(prev.route.models ?? []), ''] },
      modelUids: [...prev.modelUids, nextModelUid()],
      error: '',
    }));
  }, []);

  const updateModelEntry = useCallback((index: number, value: string) => {
    setEditor((prev) => {
      const models = (prev.route.models ?? []).map((model, current) =>
        current === index ? value : model
      );
      return { ...prev, route: { ...prev.route, models }, error: '' };
    });
  }, []);

  const removeModelEntry = useCallback((index: number) => {
    setEditor((prev) => ({
      ...prev,
      route: {
        ...prev.route,
        models: (prev.route.models ?? []).filter((_, current) => current !== index),
      },
      modelUids: prev.modelUids.filter((_, current) => current !== index),
      error: '',
    }));
  }, []);

  const validateRoute = useCallback(
    (route: ModelRoute): string => {
      if (!route.alias) return t('model_routes.error_alias_required');
      if (hasThinkingSuffix(route.alias)) return t('model_routes.error_alias_suffix');

      const aliasKey = route.alias.toLowerCase();
      const duplicateAlias = routes.some(
        (existing) =>
          existing.alias.toLowerCase() === aliasKey &&
          existing.alias.toLowerCase() !== (editor.originalAlias ?? '').toLowerCase()
      );
      if (duplicateAlias) {
        return t('model_routes.error_duplicate_alias', { alias: route.alias });
      }

      const cooldown = route['cooldown-seconds'];
      if (
        cooldown !== undefined &&
        (!Number.isFinite(cooldown) || !Number.isInteger(cooldown) || cooldown < 1)
      ) {
        return t('model_routes.error_cooldown_positive_integer');
      }

      if (route.models.length === 0) return t('model_routes.error_model_required');
      const seenModels = new Set<string>();
      for (const model of route.models) {
        const modelKey = model.toLowerCase();
        if (seenModels.has(modelKey)) {
          return t('model_routes.error_duplicate_model', { model });
        }
        seenModels.add(modelKey);
      }

      const routeAliases = new Set(
        routes
          .map((existing) =>
            existing.alias === editor.originalAlias ? route.alias : existing.alias
          )
          .concat(route.alias)
          .map((alias) => alias.trim().toLowerCase())
          .filter(Boolean)
      );
      const nestedTarget = route.models.find((model) =>
        routeAliases.has(baseModelName(model).toLowerCase())
      );
      if (nestedTarget) {
        return t('model_routes.error_nested_route', { model: nestedTarget });
      }

      return '';
    },
    [editor.originalAlias, routes, t]
  );

  const saveRoute = useCallback(async () => {
    const cleanRoute = trimRoute(editor.route);
    const validationError = validateRoute(cleanRoute);
    if (validationError) {
      setEditor((prev) => ({ ...prev, error: validationError }));
      return;
    }

    const nextRoutes =
      editor.originalAlias === null
        ? [...routes, cleanRoute]
        : routes.some((route) => route.alias === editor.originalAlias)
          ? routes.map((route) => (route.alias === editor.originalAlias ? cleanRoute : route))
          : [...routes, cleanRoute];

    setEditor((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      await modelRoutesApi.replace(nextRoutes);
      showNotification(t('model_routes.saved'), 'success');
      closeEditor();
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('model_routes.save_failed');
      setEditor((prev) => ({ ...prev, saving: false, error: message }));
    }
  }, [closeEditor, editor, load, routes, showNotification, t, validateRoute]);

  const deleteRoute = useCallback(
    async (alias: string) => {
      if (!window.confirm(t('model_routes.confirm_delete', { alias }))) return;
      try {
        await modelRoutesApi.replace(routes.filter((route) => route.alias !== alias));
        showNotification(t('model_routes.deleted'), 'success');
        await load();
      } catch (err) {
        const message = err instanceof Error ? err.message : t('model_routes.delete_failed');
        showNotification(message, 'error');
      }
    },
    [load, routes, showNotification, t]
  );

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('model_routes.title')}</h1>
        <p className={styles.description}>{t('model_routes.description')}</p>
      </div>

      <div className={styles.toolbar}>
        <Button variant="secondary" onClick={load} disabled={loading || editor.saving}>
          {iconText(<IconRefreshCw size={14} />, t('common.refresh'))}
        </Button>
        <Button variant="primary" onClick={openCreate} disabled={disabled || loading}>
          {iconText(<IconPlus size={14} />, t('model_routes.add_route'))}
        </Button>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {loading && routes.length === 0 ? (
        <div className={styles.loadingLine}>{t('common.loading')}</div>
      ) : sortedRoutes.length === 0 ? (
        <EmptyState
          title={t('model_routes.empty_title')}
          description={t('model_routes.empty_description')}
          action={
            <Button variant="primary" onClick={openCreate} disabled={disabled}>
              {iconText(<IconPlus size={14} />, t('model_routes.add_route'))}
            </Button>
          }
        />
      ) : (
        <div className={styles.tableShell}>
          <table className={styles.routesTable}>
            <thead>
              <tr>
                <th>{t('model_routes.field_alias')}</th>
                <th>{t('model_routes.field_strategy')}</th>
                <th>{t('model_routes.field_cooldown')}</th>
                <th>{t('model_routes.field_models')}</th>
                <th>{t('common.action')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoutes.map((route) => (
                <tr key={route.alias}>
                  <td className={styles.aliasCell}>{route.alias}</td>
                  <td>
                    <span className={styles.strategyPill}>
                      {t(strategyLabelKey(route.strategy))}
                    </span>
                  </td>
                  <td className={styles.cooldownCell}>
                    {t('model_routes.cooldown_seconds', {
                      count: route['cooldown-seconds'] ?? 60,
                    })}
                  </td>
                  <td>
                    <div className={styles.modelList}>
                      {(route.models ?? []).map((model) => (
                        <span key={model} className={styles.modelChip}>
                          {model}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className={styles.tableActions}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(route)}
                        disabled={disabled}
                      >
                        {iconText(<IconPencil size={13} />, t('common.edit'))}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => deleteRoute(route.alias)}
                        disabled={disabled}
                      >
                        {iconText(<IconTrash2 size={13} />, t('common.delete'))}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editor.open}
        onClose={editor.saving ? () => undefined : closeEditor}
        title={
          editor.originalAlias === null
            ? t('model_routes.modal_title_create')
            : t('model_routes.modal_title_edit')
        }
        width={720}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={closeEditor} disabled={editor.saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={saveRoute}
              loading={editor.saving}
              disabled={editor.saving}
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <div className={styles.formRow}>
            <Input
              label={t('model_routes.field_alias')}
              value={editor.route.alias}
              onChange={(event) => updateRouteField('alias', event.target.value)}
              placeholder={t('model_routes.alias_placeholder')}
              hint={t('model_routes.field_alias_hint')}
            />
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="model-route-strategy">
                {t('model_routes.field_strategy')}
              </label>
              <Select
                id="model-route-strategy"
                value={editor.route.strategy || 'priority'}
                onChange={(value) => updateRouteField('strategy', value as ModelRoute['strategy'])}
                options={strategyOptions}
              />
            </div>
          </div>

          <Input
            label={t('model_routes.field_cooldown')}
            type="number"
            min={1}
            step={1}
            value={editor.route['cooldown-seconds'] ?? ''}
            onChange={(event) => {
              const value = event.target.value.trim();
              updateRouteField('cooldown-seconds', value === '' ? undefined : Number(value));
            }}
            hint={t('model_routes.field_cooldown_hint')}
          />

          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <div>
                <div className={styles.fieldLabel}>{t('model_routes.field_models')}</div>
                <div className={styles.fieldHint}>{t('model_routes.field_models_hint')}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={addModelEntry}>
                {iconText(<IconPlus size={13} />, t('model_routes.add_model'))}
              </Button>
            </div>
            <div className={styles.modelEntries}>
              {(editor.route.models ?? []).map((model, index) => (
                <div key={editor.modelUids[index]} className={styles.modelEntry}>
                  <Input
                    aria-label={t('model_routes.model_entry_label', { index: index + 1 })}
                    value={model}
                    onChange={(event) => updateModelEntry(index, event.target.value)}
                    placeholder={t('model_routes.model_placeholder')}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeModelEntry(index)}
                    aria-label={t('model_routes.remove_model_label', { index: index + 1 })}
                  >
                    {iconText(<IconTrash2 size={13} />, t('common.delete'))}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {editor.error && <div className={styles.fieldError}>{editor.error}</div>}
        </div>
      </Modal>
    </div>
  );
}
