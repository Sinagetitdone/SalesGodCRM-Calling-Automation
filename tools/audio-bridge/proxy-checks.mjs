import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proxyEnvironment } from './start.mjs';

test('configured Windows HTTP proxy is used for HTTPS and localhost bypass is retained', () => {
  const env = { OPENAI_API_KEY: 'synthetic', NO_PROXY: '.internal' };
  const result = proxyEnvironment(env, { enabled: true, server: '127.0.0.1:9999' });
  assert.equal(result.HTTPS_PROXY, 'http://127.0.0.1:9999/');
  assert.equal(result.NO_PROXY, '.internal,localhost,127.0.0.1,::1');
  assert.equal(result.no_proxy, result.NO_PROXY);
  assert.equal(result.OPENAI_API_KEY, 'synthetic');
  assert.equal(env.HTTPS_PROXY, undefined);
});
test('explicit environment proxy takes precedence over Windows and works on Mac', () => {
  assert.equal(proxyEnvironment({ https_proxy: 'http://explicit:9999' }, { enabled: true, server: 'other:9999' }).https_proxy, 'http://explicit:9999');
  assert.equal(proxyEnvironment({ HTTPS_PROXY: 'http://explicit:9999' }, null).HTTPS_PROXY, 'http://explicit:9999');
  assert.deepEqual(proxyEnvironment({}, { enabled: false, server: 'unused:9999' }), {});
});
test('per-protocol proxy uses HTTPS and unsupported configuration never silently falls back', () => {
  assert.equal(proxyEnvironment({}, { enabled: true, server: 'http=plain:80;https=secure:8080' }).HTTPS_PROXY, 'http://secure:8080/');
  assert.throws(() => proxyEnvironment({}, { enabled: true, server: 'socks5://localhost:9999' }), /HTTP\/HTTPS proxy/);
  assert.throws(() => proxyEnvironment({}, { enabled: true, server: 'http=plain:80' }), /no HTTPS entry/);
});
