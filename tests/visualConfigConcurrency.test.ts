import { describe, expect, test } from 'bun:test';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse as parseYaml } from 'yaml';
import { useVisualConfig } from '../src/hooks/useVisualConfig';

describe('visual config concurrency', () => {
  test('only applies dirty visual fields to the latest server YAML', () => {
    function Harness() {
      const visualConfig = useVisualConfig();
      const [phase, setPhase] = useState(0);

      if (phase === 0) {
        visualConfig.loadVisualValuesFromYaml(
          'debug: false\nproxy-url: http://old-proxy.example\n'
        );
        setPhase(1);
      } else if (phase === 1) {
        visualConfig.setVisualValues({ proxyUrl: 'http://localhost:8080' });
        setPhase(2);
      } else {
        return createElement(
          'pre',
          null,
          visualConfig.applyVisualChangesToYaml(
            'debug: true\nproxy-url: http://old-proxy.example\n'
          )
        );
      }

      return null;
    }

    const markup = renderToStaticMarkup(createElement(Harness));
    const merged = markup.slice('<pre>'.length, -'</pre>'.length);

    expect(parseYaml(merged)).toEqual({
      debug: true,
      'proxy-url': 'http://localhost:8080',
    });
  });

  test('prefers the Gemini API header default over the legacy Gemini CLI key', () => {
    function Harness() {
      const visualConfig = useVisualConfig();
      const [loaded, setLoaded] = useState(false);

      if (!loaded) {
        visualConfig.loadVisualValuesFromYaml(
          'gemini-header-defaults:\n  user-agent: gemini-api\n' +
            'gemini-cli-header-defaults:\n  user-agent: gemini-cli\n'
        );
        setLoaded(true);
        return null;
      }

      return createElement('pre', null, visualConfig.visualValues.geminiHeaderUserAgent);
    }

    expect(renderToStaticMarkup(createElement(Harness))).toBe('<pre>gemini-api</pre>');
  });

  test('migrates the legacy Gemini key while updating fork provider headers', () => {
    const originalYaml =
      'debug: true\n' +
      'gemini-cli-header-defaults:\n  user-agent: old-gemini\n' +
      'openai-compatibility-header-defaults:\n  user-agent: old-openai\n' +
      'kimi-header-defaults:\n  user-agent: old-kimi\n' +
      'antigravity-header-defaults:\n  user-agent: old-antigravity\n';

    function Harness() {
      const visualConfig = useVisualConfig();
      const [phase, setPhase] = useState(0);

      if (phase === 0) {
        visualConfig.loadVisualValuesFromYaml(originalYaml);
        setPhase(1);
      } else if (phase === 1) {
        visualConfig.setVisualValues({
          geminiHeaderUserAgent: 'new-gemini',
          openAICompatHeaderUserAgent: 'new-openai',
          kimiHeaderUserAgent: 'new-kimi',
          antigravityHeaderUserAgent: 'new-antigravity',
        });
        setPhase(2);
      } else {
        return createElement('pre', null, visualConfig.applyVisualChangesToYaml(originalYaml));
      }

      return null;
    }

    const markup = renderToStaticMarkup(createElement(Harness));
    const merged = parseYaml(markup.slice('<pre>'.length, -'</pre>'.length));

    expect(merged).toEqual({
      debug: true,
      'gemini-header-defaults': { 'user-agent': 'new-gemini' },
      'openai-compatibility-header-defaults': { 'user-agent': 'new-openai' },
      'kimi-header-defaults': { 'user-agent': 'new-kimi' },
      'antigravity-header-defaults': { 'user-agent': 'new-antigravity' },
    });
  });
});
