const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const steps = ['Claim Received','Initial Review','Evidence Gathering','Preparation for Notification','Complete'];
let currentData = {};
let detailItem = null;

const resourceLinks = [
  ['Claim status / upload evidence', 'https://www.va.gov/claim-or-appeal-status/'],
  ['Upload supporting evidence', 'https://www.va.gov/disability/upload-supporting-evidence/'],
  ['Decision letters', 'https://www.va.gov/records/download-va-letters/letters'],
  ['Disability rating', 'https://www.va.gov/disability/view-disability-rating/'],
  ['Compensation rates', 'https://www.va.gov/disability/compensation-rates/veteran-rates/'],
  ['PACT Act benefits', 'https://www.va.gov/resources/the-pact-act-and-your-va-benefits/'],
  ['Burn pits / hazardous exposure', 'https://www.va.gov/disability/eligibility/hazardous-materials-exposure/specific-environmental-hazards/'],
  ['Evidence needed', 'https://www.va.gov/disability/how-to-file-claim/evidence-needed/'],
  ['File VA Form 21-526EZ online', 'https://www.va.gov/disability/file-disability-claim-form-21-526ez/'],
  ['Find a VA location', 'https://www.va.gov/find-locations/'],
  ['VA benefit eligibility matrix', 'https://benefits.va.gov/BENEFITS/derivative_sc.asp'],
  ['State Veterans Affairs offices', 'https://department.va.gov/about/state-departments-of-veterans-affairs-office-locations/']
];

const formLinks = [
  ['21-526EZ', 'Disability compensation claim', 'https://www.va.gov/disability/file-disability-claim-form-21-526ez/'],
  ['20-0995', 'Supplemental Claim / new and relevant evidence', 'https://www.va.gov/find-forms/about-form-20-0995/'],
  ['20-0996', 'Higher-Level Review', 'https://www.va.gov/find-forms/about-form-20-0996/'],
  ['10182', 'Board Appeal / Notice of Disagreement', 'https://www.va.gov/find-forms/about-form-10182/'],
  ['21-8940', 'Individual Unemployability', 'https://www.va.gov/find-forms/about-form-21-8940/'],
  ['21-4138', 'Statement in Support of Claim', 'https://www.va.gov/find-forms/about-form-21-4138/'],
  ['21-0781', 'PTSD Statement', 'https://www.va.gov/find-forms/about-form-21-0781/'],
  ['21-4142', 'Authorize release of private medical records', 'https://www.va.gov/find-forms/about-form-21-4142/'],
  ['21-686c', 'Add/remove dependents', 'https://www.va.gov/find-forms/about-form-21-686c/'],
  ['10-10EZ', 'Apply for VA health care', 'https://www.va.gov/health-care/how-to-apply/']
];

function normalizePhase(phase = '') {
  const p = String(phase).toLowerCase();
  if (p.includes('complete')) return 'Complete';
  if (p.includes('notification') || p.includes('decision')) return 'Preparation for Notification';
  if (p.includes('evidence') || p.includes('review of evidence')) return 'Evidence Gathering';
  if (p.includes('initial')) return 'Initial Review';
  if (p.includes('received')) return 'Claim Received';
  return null;
}

function labelize(k = '') {
  return String(k)
    .replace(/attributes\./g, '')
    .replace(/data\./g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._\[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, m => m.toUpperCase());
}

function isSensitiveKey(k = '') {
  return /account|routing|check|bank|payment id|ssn|social|claim id|file number|icn|edipi|uuid|token|authorization|cookie/i.test(k);
}

function redactValue(k, v) {
  const s = String(v ?? '');
  if (!s) return s;
  if (isSensitiveKey(k)) {
    if (/bank/i.test(k) && !/account|routing/i.test(k)) return s;
    const digits = s.replace(/\D/g, '');
    if (digits.length >= 4) return `••••${digits.slice(-4)}`;
    if (s.length > 8) return `${s.slice(0, 2)}••••${s.slice(-2)}`;
  }
  if (/\b\d{9,}\b/.test(s)) return s.replace(/\b\d{5,}(\d{4})\b/g, '••••$1');
  return s;
}

function safeEntries(obj, max = 12) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .filter(([k,v]) => !['source','body','raw','headers'].includes(k) && v !== null && v !== undefined && String(v).trim() !== '' && typeof v !== 'object')
    .map(([k,v]) => [labelize(k), redactValue(k, v)])
    .slice(0, max);
}

function dl(fields) {
  const rows = fields.filter(([,v]) => v !== null && v !== undefined && String(v).trim() !== '');
  return rows.length ? rows.map(([k,v]) => `<dt>${esc(labelize(k))}</dt><dd>${esc(redactValue(k, v))}</dd>`).join('') : '<dt>Status</dt><dd>No data detected for this section yet.</dd>';
}

function titleFor(item, fallback, i) {
  return item?.title || item?.subject || item?.name || item?.messageSubject || item?.folderName || item?.['attributes.type'] || item?.type || item?.dataType || `${fallback} ${i + 1}`;
}

function urlFromItem(item = {}) {
  return item.href || item.url || item.self || item['links.self'] || item['links.html'] || item['attributes.url'] || item['downloadUrl'] || item['fileUrl'];
}

function attachmentLinks(item = {}) {
  const links = [];
  for (const [k, v] of Object.entries(item || {})) {
    if (/attachment|file|document|download|href|url|link/i.test(k) && typeof v === 'string' && /^https?:\/\//.test(v)) links.push([labelize(k), v]);
    if (/attachment|file|document/i.test(k) && typeof v === 'string' && !/^https?:\/\//.test(v)) links.push([labelize(k), v]);
  }
  return links;
}

function miniCard(item, i, section, fallback = 'Item', tone = '') {
  const title = titleFor(item, fallback, i);
  const url = urlFromItem(item);
  const fields = safeEntries(item, 10);
  const linkBtns = [];
  if (url && /^https?:\/\//.test(url)) linkBtns.push(`<a target="_blank" rel="noreferrer" href="${esc(url)}">Open</a>`);
  const atts = attachmentLinks(item).slice(0, 3);
  atts.forEach(([name, link]) => {
    if (/^https?:\/\//.test(link)) linkBtns.push(`<a target="_blank" rel="noreferrer" href="${esc(link)}">${esc(name)}</a>`);
  });
  linkBtns.push(`<button data-detail-section="${esc(section)}" data-detail-index="${i}">Details</button>`);
  return `<article class="mini clickable ${tone}" data-detail-section="${esc(section)}" data-detail-index="${i}">
    <h3>${esc(title)}</h3><dl>${dl(fields)}</dl><div class="mini-actions">${linkBtns.join('')}</div></article>`;
}

function renderCards(containerId, items, fallbackSignals = [], titlePrefix = 'Item', section = containerId) {
  const el = $(containerId);
  const normalized = (items || []).filter(Boolean).slice(0, 80);
  const cards = normalized.map((item, i) => miniCard(item, i, section, titlePrefix));
  if (!cards.length && fallbackSignals?.length) {
    fallbackSignals.slice(0, 12).forEach((s, i) => cards.push(miniCard({ title: `${titlePrefix} signal ${i + 1}`, visibleText: s.text, context: s.context }, i, section, titlePrefix, /needed|required|overdue|unread/i.test(s.context || '') ? 'warning' : '')));
  }
  el.innerHTML = cards.join('') || '<div class="empty">No data captured yet. Navigate to the relevant VA.gov section, reload that VA.gov page, then refresh this extension.</div>';
}

function numberFromAny(...vals) {
  for (const v of vals.flat()) {
    const m = String(v ?? '').match(/\b(100|[1-9]0)\b/);
    if (m) return Number(m[1]);
  }
  return null;
}

function detectedRating(data = {}) {
  const b = JSON.stringify(data.benefits || {});
  const visible = [...(data.benefits?.visibleSignals || [])].map(x => `${x.text} ${x.context}`).join(' ');
  return numberFromAny(data.benefits?.cards?.map(x => Object.values(x).join(' ')) || [], b, visible);
}

function checks(data) {
  const out = [];
  const summary = data.claims?.summary || {};
  if (/yes/i.test(summary.documentsNeeded || '')) out.push('Documents appear to be needed. Open Documents and verify upload requirements on VA.gov.');
  if (!summary.currentPhase && !summary.status) out.push('Claim phase was not detected. Open the detailed claim page, not only the My VA landing page.');
  if ((data.api?.capturedCount || 0) === 0) out.push('No VA API responses captured yet. Reload the VA.gov page after opening this extension, then refresh.');
  if (!(data.messages?.cards || []).length) out.push('Messages are not captured yet. Visit the My HealtheVet secure messaging section, reload, then refresh.');
  if (!(data.documents?.cards || []).length && !(data.documents?.links || []).length) out.push('Documents are not captured yet. Visit claim letters, decision letters, or evidence upload pages.');
  if (detectedRating(data) >= 100) out.push('100% rating detected. Review dental, commissary/exchange, state/local benefits, and dependent benefit links in Benefits.');
  if (!out.length) out.push('No urgent missing-document or unread-message signal detected from captured data.');
  return out;
}

function linkChip([label, href], extra = '') {
  return `<a class="link-chip external ${extra}" target="_blank" rel="noreferrer" href="${esc(href)}">${esc(label)}</a>`;
}

function renderBenefitGuide(data) {
  const rating = detectedRating(data);
  const guide = [];
  if (rating !== null) guide.push(['Detected combined rating', `${rating}%`]);
  guide.push(['What Lighthouse means', 'Lighthouse is the VA API/data platform name. In this app it means the rating came from a VA API response, not from manual typing.']);
  if (rating >= 10) guide.push(['Core benefit', 'Monthly tax-free VA disability compensation.']);
  if (rating >= 30) guide.push(['Dependent pay', 'Ratings 30% and higher may include additional compensation for eligible dependents.']);
  if (rating >= 50) guide.push(['Health-care priority', 'Higher ratings may affect VA health-care priority group and copay exposure.']);
  if (rating >= 100) guide.push(['100% review list', 'Check dental, commissary/exchange, CHAMPVA/dependent education where applicable, property-tax/state benefits, and ID card privileges.']);
  $('benefitGuide').innerHTML = guide.map(([k,v]) => `<article class="mini good"><h3>${esc(k)}</h3><p>${esc(v)}</p></article>`).join('') + resourceLinks.filter(([label]) => /rating|Compensation|eligibility|State|PACT|Burn pits/i.test(label)).map(l => linkChip(l)).join('');
}

function renderFormsGuide(data) {
  const claimType = JSON.stringify(data.claims || {}).toLowerCase();
  const rec = [];
  rec.push(['Claim packet checklist', 'Condition name, diagnosis, service event/exposure, nexus theory, symptoms, treatment history, VA/private records, lay statements, and relevant uploaded evidence.']);
  if (/supplemental|0995/.test(claimType)) rec.push(['Supplemental Claim signal', 'Use new and relevant evidence. Verify whether VA Form 20-0995 applies.']);
  if (/higher-level|0996/.test(claimType)) rec.push(['Higher-Level Review signal', 'This lane usually reviews existing evidence. Verify whether VA Form 20-0996 applies.']);
  if (/pact|tera|toxic|exposure|burn pit|agent orange|gulf war/.test(JSON.stringify(data).toLowerCase())) rec.push(['TERA / PACT Act signal', 'Capture exposure location, date range, MOS/duties, deployment record, symptoms, diagnosis, and toxic exposure screening details.']);
  else rec.push(['TERA / PACT Act prep', 'Consider whether toxic exposure, burn pits, Gulf War hazards, Agent Orange, radiation, contaminated water, or occupational exposure may be relevant.']);
  $('formsGuide').innerHTML = rec.map(([k,v]) => `<article class="mini resource"><h3>${esc(k)}</h3><p>${esc(v)}</p></article>`).join('') + formLinks.map(([id, desc, href]) => linkChip([`${id}: ${desc}`, href])).join('');
}

function renderQuickActions() {
  $('quickActions').innerHTML = resourceLinks.slice(0, 10).map(l => linkChip(l)).join('');
}

function redactedClone(obj) {
  if (Array.isArray(obj)) return obj.map(redactedClone);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = typeof v === 'object' ? redactedClone(v) : redactValue(k, v);
    return out;
  }
  return obj;
}

function buildReport(data = {}) {
  const summary = data.claims?.summary || {};
  const rating = detectedRating(data);
  const lines = [];
  lines.push('PATRIOT CLAIM TRACKER - LOCAL VETERAN PACKET');
  lines.push(`Captured: ${data.capturedAt || 'Unknown'}`);
  lines.push(`Source: ${data.source || data.page?.url || 'Unknown'}`);
  lines.push('');
  lines.push('CLAIM SUMMARY');
  [['Type', summary.claimType], ['Initiated', summary.claimInitiated], ['Phase', summary.currentPhase], ['Status', summary.status], ['Documents needed', summary.documentsNeeded], ['Decision letter sent', summary.decisionLetterSent]].forEach(([k,v]) => { if (v) lines.push(`- ${k}: ${redactValue(k, v)}`); });
  lines.push('');
  lines.push('BENEFITS');
  if (rating !== null) lines.push(`- Detected combined rating: ${rating}%`);
  (data.benefits?.cards || []).slice(0, 8).forEach((x, i) => lines.push(`- Benefit ${i+1}: ${Object.entries(x).filter(([,v]) => typeof v !== 'object').slice(0,5).map(([k,v]) => `${labelize(k)}=${redactValue(k,v)}`).join('; ')}`));
  lines.push('');
  lines.push('MESSAGES');
  (data.messages?.cards || []).slice(0, 10).forEach((x, i) => lines.push(`- Message/folder ${i+1}: ${titleFor(x,'Message',i)}`));
  lines.push('');
  lines.push('DOCUMENTS');
  ([...(data.documents?.cards || []), ...(data.documents?.links || [])]).slice(0, 12).forEach((x, i) => lines.push(`- Document ${i+1}: ${titleFor(x,'Document',i)} ${urlFromItem(x) || ''}`));
  lines.push('');
  lines.push('CLAIM PREP REMINDERS');
  lines.push('- Evidence: diagnosis, current symptoms, service event/exposure, nexus theory, continuity/treatment history, and lay statements.');
  lines.push('- PACT Act / TERA: document possible toxic exposures, deployment locations, duties/MOS, dates, and toxic exposure screening details.');
  lines.push('- Verify forms: 21-526EZ, 20-0995, 20-0996, 10182, 21-4138, 21-4142, 21-8940 as applicable.');
  return lines.join('\n');
}

function renderApiEvents(data) {
  const events = data.api?.events || [];
  $('apiEvents').innerHTML = events.slice(-20).reverse().map(e => `<div class="event"><strong>${esc((e.method || 'GET') + ' ' + (e.category || 'other'))}</strong><small>${esc(e.url || '')}</small><br><small>Status ${esc(e.status || '')} · ${esc(e.capturedAt || '')}</small></div>`).join('') || '<div class="empty">No API events captured yet.</div>';
}

function render(data = {}) {
  currentData = data || {};
  const summary = currentData.claims?.summary || currentData || {};
  $('phase').textContent = summary.currentPhase || summary.status || 'No claim data detected';
  $('daysOpen').textContent = summary.daysOpen ?? '—';
  $('apiCount').textContent = currentData.api?.capturedCount ?? 0;
  $('syncState').textContent = currentData.capturedAt ? `SYNC ${new Date(currentData.capturedAt).toLocaleTimeString()}` : 'BETA';

  const active = normalizePhase(summary.currentPhase || summary.status || '');
  const activeIndex = active ? steps.indexOf(active) : -1;
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.toggle('done', i < activeIndex || active === 'Complete');
    el.classList.toggle('active', i === activeIndex && active !== 'Complete');
  });

  $('profile').innerHTML = dl([
    ['Name', currentData.profile?.name], ['Email', currentData.profile?.email], ['Phone', currentData.profile?.phone],
    ['Address', currentData.profile?.address], ['Last four', currentData.profile?.lastFour], ['Detected page', currentData.profile?.detectedOn]
  ]);
  $('checks').innerHTML = checks(currentData).map(x => `<li>${esc(x)}</li>`).join('');

  const map = currentData.api?.byCategory || {};
  const fixedSections = ['claims','messages','documents','benefits','payments','health','profile','forms','other'];
  $('dataMap').innerHTML = fixedSections.map(k => `<span class="chip">${esc(k)}: ${esc(map[k] || 0)}</span>`).join('') +
    `<span class="chip">tables: ${esc(currentData.page?.tables?.length || 0)}</span><span class="chip">links: ${esc(currentData.page?.links?.length || 0)}</span>`;

  $('claimSummary').innerHTML = dl([
    ['Claim type', summary.claimType], ['Initiated', summary.claimInitiated], ['Current phase', summary.currentPhase],
    ['Status', summary.status], ['Phase change', summary.phaseChangeDate], ['Temp jurisdiction', summary.tempJurisdiction],
    ['Jurisdiction', summary.jurisdiction], ['Claim code', summary.claimTypeCode], ['End product', summary.endProductCode],
    ['Documents needed', summary.documentsNeeded], ['Decision letter sent', summary.decisionLetterSent], ['Development letter sent', summary.developmentLetterSent]
  ]);

  renderCards('claimCards', currentData.claims?.cards, currentData.claims?.visibleSignals, 'Claim', 'claims');
  renderCards('messageCards', currentData.messages?.cards, currentData.messages?.visibleSignals, 'Message', 'messages');
  const docItems = [...(currentData.documents?.cards || []), ...(currentData.documents?.links || []).map(l => ({ title: l.text, href: l.href }))];
  renderCards('documentCards', docItems, currentData.documents?.visibleSignals, 'Document', 'documents');
  renderBenefitGuide(currentData);
  renderCards('benefitCards', currentData.benefits?.cards, currentData.benefits?.visibleSignals, 'Benefit', 'benefits');
  renderCards('healthCards', currentData.health?.cards, currentData.health?.visibleSignals, 'Health', 'health');
  renderCards('paymentCards', currentData.payments?.cards, currentData.payments?.visibleSignals, 'Payment', 'payments');
  renderFormsGuide(currentData);
  const formItems = [...(currentData.forms?.cards || []), ...(currentData.forms?.links || []).map(l => ({ title: l.text, href: l.href }))];
  renderCards('formCards', formItems, currentData.forms?.visibleSignals, 'Form', 'forms');
  renderQuickActions();

  const report = buildReport(currentData);
  $('report').textContent = report;
  $('raw').textContent = JSON.stringify(redactedClone(currentData), null, 2);
  renderApiEvents(currentData);
}

function sectionArray(section) {
  if (section === 'documents') return [...(currentData.documents?.cards || []), ...(currentData.documents?.links || []).map(l => ({ title: l.text, href: l.href }))];
  return currentData[section]?.cards || [];
}

function flattenForTable(obj, prefix = '', rows = []) {
  if (rows.length > 300) return rows;
  if (obj == null) return rows;
  if (Array.isArray(obj)) return obj.slice(0, 40).forEach((v,i) => flattenForTable(v, `${prefix}[${i}]`, rows)) || rows;
  if (typeof obj === 'object') return Object.entries(obj).slice(0, 80).forEach(([k,v]) => flattenForTable(v, prefix ? `${prefix}.${k}` : k, rows)) || rows;
  rows.push([prefix, redactValue(prefix, obj)]);
  return rows;
}

function showDetail(section, index) {
  const item = sectionArray(section)[Number(index)];
  if (!item) return;
  detailItem = item;
  $('detailType').textContent = section.toUpperCase();
  $('detailTitle').textContent = titleFor(item, 'Captured item', Number(index));
  const links = [];
  const mainUrl = urlFromItem(item);
  if (mainUrl && /^https?:\/\//.test(mainUrl)) links.push(['Open source/link', mainUrl]);
  attachmentLinks(item).forEach(x => links.push(x));
  const rows = flattenForTable(item).map(([k,v]) => `<tr><th>${esc(labelize(k))}</th><td>${esc(v)}</td></tr>`).join('');
  $('detailBody').innerHTML = `${links.length ? `<div class="detail-links">${links.map(([k,v]) => /^https?:\/\//.test(v) ? linkChip([k,v]) : `<span class="chip">${esc(k)}: ${esc(v)}</span>`).join('')}</div>` : ''}<table class="json-table"><tbody>${rows || '<tr><td>No details captured.</td></tr>'}</tbody></table>`;
  $('detailDialog').showModal();
}

async function refresh() {
  $('refresh').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https:\/\/www\.va\.gov\//.test(tab.url || '')) {
      render({ capturedAt: new Date().toISOString(), claims: { summary: { currentPhase: 'Open a VA.gov page first' } }, api: { capturedCount: 0, byCategory: {} } });
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PATRIOT_DATA' });
    render(response.data);
    await chrome.storage.local.set({ patriotLatest: response.data });
  } catch (err) {
    render({ capturedAt: new Date().toISOString(), claims: { summary: { currentPhase: 'Unable to read this page', status: String(err) } }, api: { capturedCount: 0, byCategory: {} } });
  } finally {
    $('refresh').disabled = false;
  }
}

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${btn.dataset.tab}`));
}));

document.body.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-detail-section]');
  if (!btn) return;
  if (event.target.tagName === 'A') return;
  event.preventDefault();
  event.stopPropagation();
  showDetail(btn.dataset.detailSection, btn.dataset.detailIndex);
});

$('refresh').addEventListener('click', refresh);
$('copyJson').addEventListener('click', async () => navigator.clipboard.writeText(JSON.stringify(redactedClone(currentData), null, 2)));
$('copyReport').addEventListener('click', async () => navigator.clipboard.writeText(buildReport(currentData)));
$('closeDetail').addEventListener('click', () => $('detailDialog').close());
$('copyDetail').addEventListener('click', async () => navigator.clipboard.writeText(JSON.stringify(redactedClone(detailItem || {}), null, 2)));
chrome.storage.local.get('patriotLatest').then(({ patriotLatest }) => render(patriotLatest || {}));
