(() => {
  if (window.__patriotClaimTrackerInjected) return;
  window.__patriotClaimTrackerInjected = true;

  const MAX_BODY_CHARS = 750000;
  const isVaUrl = (url) => {
    try {
      const u = new URL(url, location.href);
      return u.hostname === 'www.va.gov' || u.hostname === 'api.va.gov' || u.hostname.endsWith('.va.gov');
    } catch (_) {
      return false;
    }
  };

  const post = (payload) => {
    try {
      window.postMessage({ source: 'PATRIOT_CLAIM_TRACKER', ...payload }, '*');
    } catch (_) {}
  };

  const sanitizeHeaders = (headers) => {
    const out = {};
    try {
      headers.forEach((value, key) => {
        const k = String(key).toLowerCase();
        if (!['authorization', 'cookie', 'set-cookie', 'x-csrf-token'].includes(k)) out[k] = value;
      });
    } catch (_) {}
    return out;
  };

  const handleResponse = async (url, response, method = 'GET') => {
    if (!isVaUrl(url)) return;
    try {
      const clone = response.clone();
      const headers = sanitizeHeaders(clone.headers);
      const contentType = headers['content-type'] || '';
      let body = null;
      if (contentType.includes('application/json')) {
        const text = await clone.text();
        if (text.length <= MAX_BODY_CHARS) {
          try { body = JSON.parse(text); } catch (_) { body = text; }
        } else {
          body = { truncated: true, length: text.length };
        }
      } else if (/json|claims|benefits|letters|messages|documents|appeals|payment|rating/i.test(String(url))) {
        const text = await clone.text();
        body = text.slice(0, 12000);
      }
      post({
        type: 'VA_API_RESPONSE',
        capturedAt: new Date().toISOString(),
        method,
        url: String(url),
        status: response.status,
        ok: response.ok,
        headers,
        body
      });
    } catch (error) {
      post({ type: 'VA_API_CAPTURE_ERROR', url: String(url), error: String(error) });
    }
  };

  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const request = args[0];
    const url = typeof request === 'string' ? request : request?.url;
    const method = args[1]?.method || request?.method || 'GET';
    const response = await originalFetch.apply(window, args);
    handleResponse(url, response, method);
    return response;
  };

  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function PatriotXHR() {
    const xhr = new OriginalXHR();
    let url = '';
    let method = 'GET';
    const open = xhr.open;
    xhr.open = function(m, u, ...rest) {
      method = m || 'GET';
      url = u || '';
      return open.call(xhr, m, u, ...rest);
    };
    xhr.addEventListener('load', () => {
      if (!isVaUrl(url)) return;
      try {
        const contentType = xhr.getResponseHeader('content-type') || '';
        let body = null;
        if (contentType.includes('application/json') && typeof xhr.responseText === 'string') {
          const text = xhr.responseText;
          body = text.length <= MAX_BODY_CHARS ? JSON.parse(text) : { truncated: true, length: text.length };
        } else if (/json|claims|benefits|letters|messages|documents|appeals|payment|rating/i.test(String(url))) {
          body = String(xhr.responseText || '').slice(0, 12000);
        }
        post({
          type: 'VA_API_RESPONSE',
          capturedAt: new Date().toISOString(),
          method,
          url: String(url),
          status: xhr.status,
          ok: xhr.status >= 200 && xhr.status < 300,
          headers: { 'content-type': contentType },
          body
        });
      } catch (error) {
        post({ type: 'VA_API_CAPTURE_ERROR', url: String(url), error: String(error) });
      }
    });
    return xhr;
  };
})();
