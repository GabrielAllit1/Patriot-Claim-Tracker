(() => {
  const STORE_KEY = 'patriotVaultV030';
  const MAX_EVENTS = 120;
  const apiEvents = [];

  function injectNetworkObserver() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('src/injected.js');
      script.onload = () => script.remove();
      (document.documentElement || document.head || document.body).appendChild(script);
    } catch (_) {}
  }

  injectNetworkObserver();

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'PATRIOT_CLAIM_TRACKER') return;
    if (event.data.type === 'VA_API_RESPONSE') {
      const item = normalizeApiEvent(event.data);
      apiEvents.push(item);
      while (apiEvents.length > MAX_EVENTS) apiEvents.shift();
      chrome.storage.local.set({ [STORE_KEY]: { lastUpdated: new Date().toISOString(), apiEvents } });
    }
  });

  const visibleText = () => document.body ? document.body.innerText || '' : '';
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const lines = () => visibleText().split('\n').map(norm).filter(Boolean);
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const lower = (s) => String(s || '').toLowerCase();
  const daysSince = (dateText) => {
    const d = new Date(dateText);
    if (Number.isNaN(d.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  };

  function normalizeApiEvent(e) {
    return {
      capturedAt: e.capturedAt,
      method: e.method,
      url: e.url,
      status: e.status,
      ok: e.ok,
      category: categorizeUrl(e.url),
      body: e.body
    };
  }

  function categorizeUrl(url = '') {
    const u = lower(url);
    if (/claim|evss|appeal|decision_reviews/.test(u)) return 'claims';
    if (/message|messaging|secure-messaging/.test(u)) return 'messages';
    if (/document|letter|evidence|upload|files|download|pdf|records/.test(u)) return 'documents';
    if (/form|21-526|20-0995|20-0996|10182|8940|4138|4142|686c|10-10ez/.test(u)) return 'forms';
    if (/rating|rated_disabilities|disabilit/.test(u)) return 'benefits';
    if (/payment|direct-deposit|bank/.test(u)) return 'payments';
    if (/payment|direct-deposit|bank|deposit/.test(u)) return 'payments';
    if (/appointment|prescription|health|clinic|facility|vets-api/.test(u)) return 'health';
    if (/user|profile|contact|address|phone|email/.test(u)) return 'profile';
    return 'other';
  }

  function pick(regex, text = visibleText()) {
    const m = text.match(regex);
    return m ? norm(m[1] || m[0]) : null;
  }

  function keyValuePairsFromDom() {
    const pairs = [];
    document.querySelectorAll('dt').forEach(dt => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName.toLowerCase() === 'dd') pairs.push({ label: norm(dt.innerText), value: norm(dd.innerText) });
    });
    document.querySelectorAll('[aria-label], label, th, .vads-u-font-weight--bold, strong').forEach(el => {
      const label = norm(el.innerText || el.getAttribute('aria-label'));
      if (!label || label.length > 80) return;
      const parentText = norm(el.parentElement?.innerText || '');
      if (parentText && parentText !== label && parentText.length < 260) {
        pairs.push({ label, value: norm(parentText.replace(label, '')) });
      }
    });
    return pairs.filter(p => p.label && p.value).slice(0, 300);
  }

  function tablesFromDom() {
    return Array.from(document.querySelectorAll('table')).map((table, tableIndex) => {
      const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th')).map(h => norm(h.innerText));
      const rows = Array.from(table.querySelectorAll('tbody tr, tr')).slice(headers.length ? 0 : 1).map(tr => {
        const cells = Array.from(tr.querySelectorAll('td, th')).map(td => norm(td.innerText));
        if (!cells.length) return null;
        if (headers.length && cells.length === headers.length) return Object.fromEntries(headers.map((h, i) => [h || `Column ${i + 1}`, cells[i]]));
        return cells;
      }).filter(Boolean);
      return { tableIndex, headers, rows: rows.slice(0, 80) };
    }).filter(t => t.rows.length);
  }

  function linksFromDom() {
    return Array.from(document.querySelectorAll('a[href]')).map(a => ({
      text: norm(a.innerText || a.getAttribute('aria-label') || a.href),
      href: a.href
    })).filter(a => a.text).slice(0, 300);
  }

  function inferItemsByKeywords(keywordRegex, max = 80) {
    const out = [];
    const all = lines();
    for (let i = 0; i < all.length; i++) {
      if (keywordRegex.test(all[i])) {
        out.push({ text: all[i], context: all.slice(Math.max(0, i - 2), i + 5).join(' | ') });
      }
    }
    return out.slice(0, max);
  }

  function apiBodies(category) {
    return apiEvents.filter(e => e.category === category && e.body).map(e => e.body);
  }

  function flattenJson(value, path = '', out = []) {
    if (out.length > 600) return out;
    if (value == null) return out;
    if (Array.isArray(value)) {
      value.slice(0, 30).forEach((v, i) => flattenJson(v, `${path}[${i}]`, out));
    } else if (typeof value === 'object') {
      Object.entries(value).slice(0, 80).forEach(([k, v]) => flattenJson(v, path ? `${path}.${k}` : k, out));
    } else {
      out.push({ path, value: String(value) });
    }
    return out;
  }

  function findApiValues(category, nameRegex) {
    const vals = [];
    apiBodies(category).forEach(body => {
      flattenJson(body).forEach(({ path, value }) => {
        if (nameRegex.test(path) || nameRegex.test(value)) vals.push({ path, value });
      });
    });
    return vals.slice(0, 80);
  }

  function sectionCardFromApi(category, primaryRegex) {
    const bodies = apiBodies(category);
    const rows = [];
    bodies.forEach((body, idx) => {
      if (Array.isArray(body)) body.slice(0, 25).forEach((x, i) => rows.push({ source: `api:${idx}:${i}`, ...compactObject(x) }));
      else if (body?.data && Array.isArray(body.data)) body.data.slice(0, 25).forEach((x, i) => rows.push({ source: `api:${idx}:data:${i}`, ...compactObject(x) }));
      else if (body && typeof body === 'object') rows.push({ source: `api:${idx}`, ...compactObject(body) });
    });
    return rows.filter(row => !primaryRegex || primaryRegex.test(JSON.stringify(row))).slice(0, 50);
  }

  function compactObject(obj) {
    if (!obj || typeof obj !== 'object') return { value: String(obj) };
    const flat = flattenJson(obj).filter(x => String(x.value).length < 300).slice(0, 35);
    const out = {};
    flat.forEach(({ path, value }) => {
      const key = path.split('.').slice(-2).join('.').replace(/attributes\./, '');
      if (!(key in out)) out[key] = value;
    });
    return out;
  }

  function extractProfile() {
    const t = visibleText();
    const pairs = keyValuePairsFromDom();
    const pairLookup = (labels) => {
      const hit = pairs.find(p => labels.some(l => lower(p.label).includes(l)));
      return hit?.value || null;
    };
    return {
      name: pairLookup(['full name', 'name']) || pick(/(?:Full name|Name)\s*:?\s*([^\n]+)/i, t),
      email: pick(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i, t),
      phone: pick(/(?:Phone|Mobile|Home phone)\s*:?\s*([+()0-9 .-]{7,})/i, t),
      address: pairLookup(['mailing address', 'address']),
      lastFour: pick(/(?:last four|last 4|SSN)\D*(\d{4})/i, t),
      detectedOn: location.href
    };
  }

  function extractClaims() {
    const t = visibleText();
    const initiated = pick(/Claim Initiated:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i, t);
    const currentPhase = pick(/Current Phase:\s*([^\n]+)/i, t) || pick(/Status:\s*([^\n]+)/i, t);
    const apiRows = sectionCardFromApi('claims', /claim|status|phase|appeal|decision|benefit/i);
    const claimLines = inferItemsByKeywords(/claim|appeal|supplemental|higher-level|evidence gathering|initial review|decision|jurisdiction|phase/i, 90);
    return {
      summary: {
        claimType: pick(/Claim Type:\s*([^\n]+)/i, t),
        claimInitiated: initiated,
        currentPhase,
        status: pick(/Status:\s*([^\n]+)/i, t),
        phaseChangeDate: pick(/Phase Change Date:\s*([^\n]+)/i, t),
        tempJurisdiction: pick(/Temp Jurisdiction:\s*([^\n]+)/i, t),
        jurisdiction: pick(/Jurisdiction:\s*([^\n]+)/i, t),
        claimTypeCode: pick(/Claim Type Code:\s*([^\n]+)/i, t),
        endProductCode: pick(/End Product Code:\s*([^\n]+)/i, t),
        documentsNeeded: pick(/Documents Needed:\s*([^\n]+)/i, t),
        decisionLetterSent: pick(/Decision Letter Sent:\s*([^\n]+)/i, t),
        developmentLetterSent: pick(/Development Letter Sent:\s*([^\n]+)/i, t),
        daysOpen: initiated ? daysSince(initiated) : null
      },
      cards: apiRows,
      visibleSignals: claimLines
    };
  }

  function extractMessages() {
    return {
      cards: sectionCardFromApi('messages', /message|subject|sender|sent|read|unread|inbox/i),
      visibleSignals: inferItemsByKeywords(/message|secure message|inbox|unread|subject|reply|sent/i, 70),
      apiSignals: findApiValues('messages', /message|subject|sender|recipient|read|sent|folder/i)
    };
  }

  function extractDocuments() {
    const docLinks = linksFromDom().filter(l => /document|letter|download|decision|evidence|upload|pdf|file/i.test(l.text + ' ' + l.href));
    return {
      cards: sectionCardFromApi('documents', /document|letter|file|upload|evidence|pdf|decision/i),
      links: docLinks,
      visibleSignals: inferItemsByKeywords(/document|letter|evidence|upload|file|pdf|decision|form|needed/i, 90),
      apiSignals: findApiValues('documents', /document|letter|filename|file|upload|evidence|decision|pdf/i)
    };
  }

  function extractBenefits() {
    return {
      cards: sectionCardFromApi('benefits', /rating|disability|condition|combined|service connected|compensation/i),
      visibleSignals: inferItemsByKeywords(/rating|disability|condition|combined|service connected|compensation|monthly|benefit/i, 90),
      apiSignals: findApiValues('benefits', /rating|disability|condition|combined|effective|diagnostic|service/i)
    };
  }

  function extractForms() {
    const formLinks = linksFromDom().filter(l => /form|21-526|20-0995|20-0996|10182|8940|4138|4142|686c|10-10ez|claim form|application/i.test(l.text + ' ' + l.href));
    return {
      cards: sectionCardFromApi('forms', /form|21-526|20-0995|20-0996|10182|8940|4138|4142|686c|10-10ez/i),
      links: formLinks,
      visibleSignals: inferItemsByKeywords(/form|application|21-526|20-0995|20-0996|10182|8940|4138|4142|686c|10-10ez|c&p|compensation and pension|tera|pact act|toxic exposure/i, 90),
      apiSignals: findApiValues('forms', /form|claim|application|upload|evidence/i)
    };
  }

  function extractPayments() {
    return {
      cards: sectionCardFromApi('payments', /payment|amount|date|bank|direct deposit/i),
      visibleSignals: inferItemsByKeywords(/payment|direct deposit|bank|amount|paid|deposit|monthly/i, 70),
      apiSignals: findApiValues('payments', /payment|amount|date|bank|deposit|account/i)
    };
  }

  function extractHealth() {
    return {
      cards: sectionCardFromApi('health', /appointment|prescription|medication|health|provider/i),
      visibleSignals: inferItemsByKeywords(/appointment|prescription|medication|health|provider|clinic|my healthevet/i, 80),
      apiSignals: findApiValues('health', /appointment|prescription|medication|health|provider|facility/i)
    };
  }

  function extractAll() {
    const data = {
      schemaVersion: '0.3.0',
      source: location.href,
      title: document.title,
      capturedAt: new Date().toISOString(),
      profile: extractProfile(),
      claims: extractClaims(),
      messages: extractMessages(),
      documents: extractDocuments(),
      benefits: extractBenefits(),
      payments: extractPayments(),
      health: extractHealth(),
      forms: extractForms(),
      page: {
        url: location.href,
        keyValuePairs: keyValuePairsFromDom(),
        tables: tablesFromDom(),
        links: linksFromDom()
      },
      api: {
        capturedCount: apiEvents.length,
        byCategory: apiEvents.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {}),
        events: apiEvents.slice(-60)
      }
    };
    chrome.storage.local.set({ patriotLatest: data });
    return data;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'EXTRACT_PATRIOT_DATA' || msg?.type === 'EXTRACT_CLAIM_DATA') {
      sendResponse({ ok: true, data: extractAll() });
    }
    return true;
  });
})();
