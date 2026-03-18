// ─────────────────────────────────────────
//  VENTSY — Módulo: Documentos
// ─────────────────────────────────────────
import { mostrarToast } from '../js/ui.js';

// ── Constantes ───────────────────────────────────────
const docCatIcons = {
    licencas: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
    alvara:   `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>`,
    juridico: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9,12 11,14 15,10"/>`,
    fiscal:   `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>`,
    seguros:  `<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>`,
    outros:   `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>`,
};
const docCatColors = {
    licencas: { bg:'#fef2f2',             stroke:'#dc2626' },
    alvara:   { bg:'#fffbeb',             stroke:'#d97706' },
    juridico: { bg:'#eff6ff',             stroke:'#1a73e8' },
    fiscal:   { bg:'rgba(255,56,92,0.07)',stroke:'#ff385c' },
    seguros:  { bg:'#f0fdf4',             stroke:'#16a34a' },
    outros:   { bg:'#f5f5f5',             stroke:'#999'    },
};
const docCatLabels    = { licencas:'Licenças', alvara:'Alvarás', juridico:'Jurídico', fiscal:'Fiscal', seguros:'Seguros', outros:'Outros' };
const docStatusLabels = { ok:'Em Dia', warning:'A Vencer', expired:'Vencido', 'no-expiry':'Permanente' };
const docBarColors    = { ok:'#16a34a', warning:'#d97706', expired:'#dc2626', 'no-expiry':'#1a73e8' };

// ── Estado do módulo ─────────────────────────────────
let docs = [
    { id:1,  nome:'Cartão CNPJ',                       cat:'fiscal',   orgao:'Receita Federal',      numero:'12.345.678/0001-90', emissao:'2020-03-10', vencimento:null,         obs:'CNPJ da pessoa jurídica. Nunca vence.',                                        arquivo:'cartao_cnpj.pdf' },
    { id:2,  nome:'RGI — Registro Geral Imóvel',       cat:'juridico', orgao:'Cartório de Registro', numero:'RGI-2019-00812',     emissao:'2019-06-22', vencimento:null,         obs:'Matrícula do imóvel onde funciona o espaço.',                                  arquivo:'rgi_imovel.pdf' },
    { id:3,  nome:'Licença Corpo de Bombeiros',         cat:'licencas', orgao:'CBMMG',                numero:'LCI-2024-4471',      emissao:'2024-03-01', vencimento:'2025-03-01', obs:'Renovar com 60 dias de antecedência.',                                         arquivo:'bombeiros_2024.pdf' },
    { id:4,  nome:'Alvará de Funcionamento',            cat:'alvara',   orgao:'Prefeitura Municipal', numero:'ALV-2024-00991',     emissao:'2024-01-15', vencimento:'2025-01-15', obs:'Renovar anualmente junto à Prefeitura.',                                       arquivo:'alvara_funcionamento.pdf' },
    { id:5,  nome:'Licença Sanitária (Anvisa)',         cat:'licencas', orgao:'Vigilância Sanitária', numero:'VS-2023-7812',       emissao:'2023-07-20', vencimento:'2025-07-20', obs:'',                                                                             arquivo:'licenca_sanitaria.pdf' },
    { id:6,  nome:'Seguro Contra Incêndio',             cat:'seguros',  orgao:'Porto Seguro',         numero:'PSG-2024-112233',    emissao:'2024-06-01', vencimento:'2025-06-01', obs:'Apólice cobre o imóvel e equipamentos. Valor: R$ 1.200.000.',                  arquivo:'seguro_incendio.pdf' },
    { id:7,  nome:'Contrato Social',                    cat:'juridico', orgao:'Junta Comercial',      numero:'NIRE-31-00123456',   emissao:'2019-02-14', vencimento:null,         obs:'Última alteração contratual realizada em 2022.',                               arquivo:'contrato_social.pdf' },
    { id:8,  nome:'Certificado de Acessibilidade',      cat:'licencas', orgao:'Prefeitura / CREA',    numero:'CA-2024-0034',       emissao:'2024-04-10', vencimento:'2026-04-10', obs:'Laudo técnico de acessibilidade.',                                             arquivo:'acessibilidade.pdf' },
    { id:9,  nome:'Alvará de Publicidade',              cat:'alvara',   orgao:'Prefeitura Municipal', numero:'PUB-2024-0078',      emissao:'2024-01-20', vencimento:'2025-01-20', obs:'Refere-se à placa externa e fachada.',                                         arquivo:'alvara_publicidade.pdf' },
    { id:10, nome:'Seguro de Responsabilidade Civil',   cat:'seguros',  orgao:'Bradesco Seguros',     numero:'BRD-2024-55901',     emissao:'2024-09-01', vencimento:'2025-09-01', obs:'Cobre danos a terceiros em eventos.',                                          arquivo:'seguro_rc.pdf' },
    { id:11, nome:'Licença Ambiental',                  cat:'licencas', orgao:'SEMAD',                numero:'LA-2023-0091',       emissao:'2023-11-01', vencimento:'2025-11-01', obs:'',                                                                             arquivo:'licenca_ambiental.pdf' },
    { id:12, nome:'Certificado de Brigada de Incêndio', cat:'licencas', orgao:'CBMMG',                numero:'CBI-2024-2234',      emissao:'2024-08-15', vencimento:'2025-08-15', obs:'Equipe treinada: 8 colaboradores certificados.',                               arquivo:'brigada_incendio.pdf' },
];
let docsNextId      = 13;
let docsActiveFilter = 'todos';
let docsSearchQuery  = '';
let docsEditingId    = null;
let docsSelectedFile = null;

// ── Init ─────────────────────────────────────────────
export function init() {
    docsRender();
    docsUpdateCounts();
    _exposeGlobals();
}

function _exposeGlobals() {
    window.docsSetFilter    = docsSetFilter;
    window.docsSearch       = docsSearch;
    window.docsOpenAddModal = docsOpenAddModal;
    window.docsCloseAddModal = docsCloseAddModal;
    window.docsOpenEditModal = docsOpenEditModal;
    window.docsSaveDoc      = docsSaveDoc;
    window.docsDeleteDoc    = docsDeleteDoc;
    window.docsViewDoc      = docsViewDoc;
    window.docsCloseViewModal = docsCloseViewModal;
    window.docsEditDoc      = docsEditDoc;
    window.docsFileSelected = docsFileSelected;
    window.docsDragOver     = docsDragOver;
    window.docsDragLeave    = docsDragLeave;
    window.docsDropFile     = docsDropFile;
    window.docsExport       = docsExport;
}

// ── Helpers de status ─────────────────────────────────
function docsGetStatus(venc) {
    if (!venc) return 'no-expiry';
    const diff = Math.ceil((new Date(venc) - new Date()) / 86400000);
    if (diff < 0)   return 'expired';
    if (diff <= 90) return 'warning';
    return 'ok';
}
function docsGetDaysLeft(venc) {
    if (!venc) return null;
    return Math.ceil((new Date(venc) - new Date()) / 86400000);
}
function docsGetBarPct(emissao, venc) {
    if (!venc || !emissao) return 100;
    const total   = new Date(venc) - new Date(emissao);
    const elapsed = Date.now() - new Date(emissao);
    return Math.max(0, Math.min(100, 100 - (elapsed / total) * 100));
}
function docsFmtDate(d) {
    if (!d) return '—';
    const [y,m,dd] = d.split('-');
    return `${dd}/${m}/${y}`;
}

// ── Contadores e banner ───────────────────────────────
export function docsUpdateCounts() {
    let ok=0, warn=0, exp=0;
    docs.forEach(d => {
        const s = docsGetStatus(d.vencimento);
        if (s==='ok') ok++; else if (s==='warning') warn++; else if (s==='expired') exp++;
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('docsCntOk',    ok);
    set('docsCntWarn',  warn);
    set('docsCntExp',   exp);
    set('docsCntTotal', docs.length);

    const issues = warn + exp;
    const banner = document.getElementById('docsAlertBanner');
    if (!banner) return;
    banner.style.display = issues === 0 ? 'none' : '';
    if (issues > 0) {
        set('docsAlertCount', issues + ' item' + (issues>1?'s':''));
        if (exp > 0) {
            set('docsAlertTitle', `${exp} documento${exp>1?'s':''} vencido${exp>1?'s':''}!`);
            set('docsAlertDesc',  'Regularize imediatamente para evitar problemas legais.');
        } else {
            set('docsAlertTitle', `${warn} documento${warn>1?'s':''} vencem em breve`);
            set('docsAlertDesc',  'Providencie a renovação com antecedência.');
        }
    }
}

// ── Render ────────────────────────────────────────────
export function docsRender() {
    const list = docs.filter(d => {
        const catMatch = docsActiveFilter === 'todos' || d.cat === docsActiveFilter;
        const q        = docsSearchQuery.toLowerCase();
        const srch     = !q || d.nome.toLowerCase().includes(q) || d.orgao.toLowerCase().includes(q);
        return catMatch && srch;
    });

    const container = document.getElementById('docsContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="docs-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          <h3>Nenhum documento encontrado</h3>
          <p>Ajuste o filtro ou adicione um novo documento.</p>
        </div>`;
        return;
    }

    const groups = [
        { key:'expired',   label:'Vencidos',            items: list.filter(d=>docsGetStatus(d.vencimento)==='expired') },
        { key:'warning',   label:'A Vencer em 90 dias', items: list.filter(d=>docsGetStatus(d.vencimento)==='warning') },
        { key:'ok',        label:'Em Dia',               items: list.filter(d=>docsGetStatus(d.vencimento)==='ok') },
        { key:'no-expiry', label:'Permanentes',          items: list.filter(d=>docsGetStatus(d.vencimento)==='no-expiry') },
    ].filter(g => g.items.length > 0);

    container.innerHTML = groups.map(g => `
      <div class="docs-section-divider">
        <h3>${g.label}</h3>
        <div class="docs-divider-line"></div>
        <span class="docs-section-count">${g.items.length}</span>
      </div>
      <div class="docs-grid">${g.items.map((d,i) => _cardHTML(d,i)).join('')}</div>
    `).join('');

    setTimeout(() => {
        document.querySelectorAll('.doc-expiry-fill').forEach(el => { el.style.width = el.dataset.w; });
    }, 100);
}

function _cardHTML(d, i) {
    const status   = docsGetStatus(d.vencimento);
    const daysLeft = docsGetDaysLeft(d.vencimento);
    const barPct   = docsGetBarPct(d.emissao, d.vencimento);
    const col      = docCatColors[d.cat] || docCatColors.outros;
    const icon     = docCatIcons[d.cat]  || docCatIcons.outros;

    let expiryHTML = '';
    if (d.vencimento) {
        const dLabel = daysLeft < 0 ? `Vencido há ${Math.abs(daysLeft)} dias`
            : daysLeft === 0 ? 'Vence hoje!'
            : `${daysLeft} dia${daysLeft!==1?'s':''} restante${daysLeft!==1?'s':''}`;
        expiryHTML = `
          <div class="doc-expiry-wrap">
            <div class="doc-expiry-top">
              <span class="doc-expiry-label-v">Validade</span>
              <span class="doc-expiry-days" style="color:${docBarColors[status]}">${dLabel}</span>
            </div>
            <div class="doc-expiry-track">
              <div class="doc-expiry-fill" style="width:0%;background:${docBarColors[status]}" data-w="${barPct}%"></div>
            </div>
          </div>`;
    }

    return `
      <div class="doc-card-v dc-${status}" style="animation-delay:${i*0.04}s">
        <div class="doc-card-stripe dc-${status}"></div>
        <div class="doc-card-body">
          <div class="doc-card-top">
            <div class="doc-card-icon-wrap" style="background:${col.bg}">
              <svg viewBox="0 0 24 24" fill="none" stroke="${col.stroke}" stroke-width="2">${icon}</svg>
            </div>
            <span class="doc-status-badge-v dc-${status}"><span class="doc-badge-dot"></span>${docStatusLabels[status]}</span>
          </div>
          <div class="doc-card-name">${d.nome}</div>
          <div class="doc-card-cat">${docCatLabels[d.cat]}</div>
          <div class="doc-card-meta">
            <div class="doc-meta-row-v"><span class="doc-meta-label-v">Órgão Emissor</span><span class="doc-meta-val-v">${d.orgao}</span></div>
            <div class="doc-meta-row-v"><span class="doc-meta-label-v">Número</span><span class="doc-meta-val-v">${d.numero||'—'}</span></div>
            <div class="doc-meta-row-v"><span class="doc-meta-label-v">Emissão</span><span class="doc-meta-val-v">${docsFmtDate(d.emissao)}</span></div>
            <div class="doc-meta-row-v"><span class="doc-meta-label-v">Vencimento</span><span class="doc-meta-val-v" style="color:${docBarColors[status]}">${d.vencimento?docsFmtDate(d.vencimento):'Não vence'}</span></div>
          </div>
          ${expiryHTML}
        </div>
        <div class="doc-card-footer">
          <button class="doc-card-action" onclick="docsViewDoc(${d.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Ver
          </button>
          <div class="doc-action-sep-v"></div>
          <button class="doc-card-action" onclick="docsOpenEditModal(${d.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar
          </button>
          <div class="doc-action-sep-v"></div>
          <button class="doc-card-action danger" onclick="docsDeleteDoc(${d.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg> Excluir
          </button>
        </div>
      </div>`;
}

// ── Filtros ───────────────────────────────────────────
export function docsSetFilter(f, el) {
    docsActiveFilter = f;
    document.querySelectorAll('.docs-filter-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    docsRender();
}
export function docsSearch(q) { docsSearchQuery = q; docsRender(); }

// ── Modal adicionar/editar ────────────────────────────
export function docsOpenAddModal() {
    docsEditingId = null; docsSelectedFile = null;
    document.getElementById('docsFormTitle').textContent = 'Novo Documento';
    ['docs-f-nome','docs-f-orgao','docs-f-numero','docs-f-obs'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const cat = document.getElementById('docs-f-cat'); if (cat) cat.value = 'licencas';
    const em  = document.getElementById('docs-f-emissao'); if (em) em.value = new Date().toISOString().split('T')[0];
    const vc  = document.getElementById('docs-f-vencimento'); if (vc) vc.value = '';
    const fp  = document.getElementById('docsFilePreview'); if (fp) fp.style.display = 'none';
    document.getElementById('docsAddModal')?.classList.add('open');
}
export function docsCloseAddModal() {
    document.getElementById('docsAddModal')?.classList.remove('open');
}
export function docsOpenEditModal(id) {
    const d = docs.find(x => x.id === id);
    if (!d) return;
    docsEditingId = id;
    document.getElementById('docsFormTitle').textContent = 'Editar Documento';
    const set = (sel, v) => { const el = document.getElementById(sel); if (el) el.value = v; };
    set('docs-f-nome', d.nome); set('docs-f-cat', d.cat); set('docs-f-orgao', d.orgao);
    set('docs-f-numero', d.numero); set('docs-f-emissao', d.emissao);
    set('docs-f-vencimento', d.vencimento || ''); set('docs-f-obs', d.obs);
    const fp = document.getElementById('docsFilePreview');
    if (d.arquivo) {
        document.getElementById('docsFilePreviewName').textContent = d.arquivo;
        if (fp) fp.style.display = 'flex';
    } else {
        if (fp) fp.style.display = 'none';
    }
    docsCloseViewModal();
    document.getElementById('docsAddModal')?.classList.add('open');
}

export function docsSaveDoc() {
    const nome = document.getElementById('docs-f-nome')?.value.trim();
    if (!nome) { document.getElementById('docs-f-nome')?.focus(); return; }
    const data = {
        nome,
        cat:        document.getElementById('docs-f-cat')?.value,
        orgao:      document.getElementById('docs-f-orgao')?.value.trim(),
        numero:     document.getElementById('docs-f-numero')?.value.trim(),
        emissao:    document.getElementById('docs-f-emissao')?.value,
        vencimento: document.getElementById('docs-f-vencimento')?.value || null,
        obs:        document.getElementById('docs-f-obs')?.value.trim(),
        arquivo:    docsSelectedFile ? docsSelectedFile.name : (docsEditingId ? docs.find(d=>d.id===docsEditingId)?.arquivo : null),
    };
    if (docsEditingId) {
        const idx = docs.findIndex(d => d.id === docsEditingId);
        docs[idx] = { ...docs[idx], ...data };
    } else {
        docs.unshift({ id: docsNextId++, ...data });
    }
    docsCloseAddModal();
    docsRender();
    docsUpdateCounts();
    mostrarToast('Documento salvo com sucesso!');
}

export function docsDeleteDoc(id) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    docs = docs.filter(d => d.id !== id);
    docsRender();
    docsUpdateCounts();
    mostrarToast('Documento excluído.');
}

// ── Modal de visualização ─────────────────────────────
export function docsViewDoc(id) {
    const d = docs.find(x => x.id === id);
    if (!d) return;
    const status   = docsGetStatus(d.vencimento);
    const daysLeft = docsGetDaysLeft(d.vencimento);
    const daysStr  = d.vencimento
        ? (daysLeft < 0 ? `Vencido há ${Math.abs(daysLeft)} dias` : `${daysLeft} dias restantes`)
        : 'Não vence';

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('docs-view-cat',     docCatLabels[d.cat]);
    set('docs-view-nome',    d.nome);
    set('docsViewFileName',  d.arquivo || 'Nenhum arquivo');

    const grid = document.getElementById('docsViewGrid');
    if (grid) grid.innerHTML = `
      <div class="docs-view-field"><div class="docs-view-field-label">Órgão Emissor</div><div class="docs-view-field-val">${d.orgao||'—'}</div></div>
      <div class="docs-view-field"><div class="docs-view-field-label">Número / Protocolo</div><div class="docs-view-field-val">${d.numero||'—'}</div></div>
      <div class="docs-view-field"><div class="docs-view-field-label">Data de Emissão</div><div class="docs-view-field-val">${docsFmtDate(d.emissao)}</div></div>
      <div class="docs-view-field"><div class="docs-view-field-label">Data de Vencimento</div><div class="docs-view-field-val" style="color:${docBarColors[status]}">${d.vencimento?docsFmtDate(d.vencimento):'Não vence'}</div></div>
      <div class="docs-view-field" style="grid-column:1/-1"><div class="docs-view-field-label">Situação</div><div class="docs-view-field-val" style="color:${docBarColors[status]}">${docStatusLabels[status]} — ${daysStr}</div></div>
    `;

    const obsWrap = document.getElementById('docsViewObsWrap');
    if (obsWrap) {
        obsWrap.style.display = d.obs ? 'block' : 'none';
        if (d.obs) set('docsViewObs', d.obs);
    }
    document.getElementById('docsViewModal')?.classList.add('open');
}
export function docsCloseViewModal() {
    document.getElementById('docsViewModal')?.classList.remove('open');
}
export function docsEditDoc() {
    const nome = document.getElementById('docs-view-nome')?.textContent;
    const d    = docs.find(x => x.nome === nome);
    if (d) docsOpenEditModal(d.id);
}

// ── Upload ────────────────────────────────────────────
export function docsFileSelected(input) {
    if (input.files[0]) _setFile(input.files[0]);
}
function _setFile(file) {
    docsSelectedFile = file;
    const pn = document.getElementById('docsFilePreviewName');
    if (pn) pn.textContent = file.name;
    const fp = document.getElementById('docsFilePreview');
    if (fp) fp.style.display = 'flex';
}
export function docsDragOver(e)  { e.preventDefault(); document.getElementById('docsUploadZone')?.classList.add('drag'); }
export function docsDragLeave()  { document.getElementById('docsUploadZone')?.classList.remove('drag'); }
export function docsDropFile(e)  { e.preventDefault(); docsDragLeave(); if (e.dataTransfer.files[0]) _setFile(e.dataTransfer.files[0]); }

// ── Exportar CSV ──────────────────────────────────────
export function docsExport() {
    const rows = ['Nome,Categoria,Órgão,Número,Emissão,Vencimento,Status'];
    docs.forEach(d => {
        rows.push([d.nome, docCatLabels[d.cat], d.orgao, d.numero, docsFmtDate(d.emissao), d.vencimento?docsFmtDate(d.vencimento):'Permanente', docStatusLabels[docsGetStatus(d.vencimento)]].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'documentos_ventsy.csv';
    a.click();
}
