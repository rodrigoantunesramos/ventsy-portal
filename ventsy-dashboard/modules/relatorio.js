// ─────────────────────────────────────────
//  VENTSY — Módulo: Relatório de Desempenho
//  Dep CDN já presente no index.html: Chart.js
// ─────────────────────────────────────────
import { sb } from '../js/api.js';
import { state } from '../js/state.js';

// ── Configuração das métricas ─────────────────────────
const METRICAS = [
    { key: 'view',       label: 'Visualizações',      icon: '👁️',  color: '#ff385c' },
    { key: 'ver_fotos',  label: 'Ver todas as fotos', icon: '📸',  color: '#3b82f6' },
    { key: 'whatsapp',   label: 'WhatsApp',           icon: '📱',  color: '#25d366' },
    { key: 'formulario', label: 'Formulários',        icon: '📋',  color: '#f59e0b' },
    { key: 'avaliacao',  label: 'Avaliações',         icon: '⭐',  color: '#8b5cf6' },
    { key: 'instagram',  label: 'Instagram',          icon: '📷',  color: '#e1306c' },
    { key: 'facebook',   label: 'Facebook',           icon: '👍',  color: '#1877f2' },
    { key: 'tiktok',     label: 'TikTok',             icon: '🎵',  color: '#010101' },
    { key: 'youtube',    label: 'YouTube',            icon: '▶️',  color: '#ff0000' },
    { key: 'linkedin',   label: 'LinkedIn',           icon: '💼',  color: '#0a66c2' },
];

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Estado do módulo ─────────────────────────────────
let _chart          = null;
let _metricaAtiva   = 'view';
let _dInicio        = null;
let _dFim           = null;
let _eventosCache   = [];
let _avaliacoesCache = [];
let _propId         = null;
let _propTipo       = '';
let _propCidade     = '';
let _dataContaCriada = null;

// ── Init ──────────────────────────────────────────────
export async function init() {
    _propId   = state.propId;
    _dataContaCriada = new Date(state.user?.created_at || Date.now() - 365*24*3600*1000);

    // Busca tipo/cidade da propriedade se não estiver no state
    if (_propId && (!_propTipo || !_propCidade)) {
        try {
            const { data } = await sb.from('propriedades')
                .select('tipo_propriedade, cidade')
                .eq('id', _propId).single();
            _propTipo   = data?.tipo_propriedade || '';
            _propCidade = data?.cidade || '';
        } catch(_) {}
    }

    // Configura date pickers
    const hoje     = new Date();
    const dataMin  = _dataContaCriada.toISOString().slice(0,10);
    const dataMax  = hoje.toISOString().slice(0,10);
    const iniDefault = new Date(hoje);
    iniDefault.setDate(iniDefault.getDate() - 29);

    _setInput('rel-data-inicio', iniDefault.toISOString().slice(0,10), dataMin, dataMax);
    _setInput('rel-data-fim',    dataMax,                               dataMin, dataMax);

    // Carrega dados históricos
    if (_propId) {
        try {
            const { data } = await sb.from('analytics_eventos')
                .select('evento_tipo, created_at')
                .eq('propriedade_id', _propId)
                .order('created_at', { ascending: true })
                .limit(10000);
            _eventosCache = data || [];
        } catch(_) {}

        try {
            const { data } = await sb.from('avaliacoes')
                .select('id, created_at')
                .eq('propriedade_id', _propId)
                .order('created_at', { ascending: true })
                .limit(2000);
            _avaliacoesCache = data || [];
        } catch(_) {}
    }

    _renderSeletorMetricas();

    // Período padrão: mês
    const btnMes = document.getElementById('rel-btn-mes');
    setPeriodo('mes', btnMes);

    // Ranking e buscas (independentes de período)
    _renderRanking();
    _renderBuscasPopulares();

    _exposeGlobals();
}

function _exposeGlobals() {
    window.relSetPeriodo          = setPeriodo;
    window.relAplicarPersonalizado = aplicarPersonalizado;
    window.relSetMetrica          = setMetrica;
}

function _setInput(id, val, min, max) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val; el.min = min; el.max = max;
}

// ── Seletor de métricas ───────────────────────────────
function _renderSeletorMetricas() {
    const container = document.getElementById('rel-seletor-metricas');
    if (!container) return;
    container.innerHTML = METRICAS.map(m => {
        const total = _contarEventos(m.key, null, null);
        const ativo = m.key === _metricaAtiva;
        return `<button class="btn-metrica${ativo ? ' ativo' : ''}"
            id="rel-btn-m-${m.key}"
            onclick="relSetMetrica('${m.key}')"
            style="${ativo ? `background:${m.color};` : ''}">
            ${m.icon} ${m.label}
            <span class="metrica-count">${total}</span>
        </button>`;
    }).join('');
}

export function setMetrica(key) {
    _metricaAtiva = key;
    METRICAS.forEach(m => {
        const btn = document.getElementById('rel-btn-m-' + m.key);
        if (!btn) return;
        if (m.key === key) { btn.classList.add('ativo');    btn.style.background = m.color; }
        else               { btn.classList.remove('ativo'); btn.style.background = ''; }
    });
    _renderGrafico();
}

// ── Período ───────────────────────────────────────────
export function setPeriodo(tipo, btn) {
    document.querySelectorAll('.rel-btn-periodo').forEach(b => b.classList.remove('ativo'));
    if (btn) btn.classList.add('ativo');

    const agora = new Date(); agora.setHours(23,59,59,999);
    const set   = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    if (tipo === 'personalizado') {
        const rp = document.getElementById('rel-range-personalizado');
        if (rp) rp.style.display = 'flex';
        return;
    }

    const rp = document.getElementById('rel-range-personalizado');
    if (rp) rp.style.display = 'none';

    const fim = new Date(agora);
    const ini = new Date(agora); ini.setHours(0,0,0,0);

    if (tipo === 'semana') {
        ini.setDate(ini.getDate() - 6);
        set('rel-label-periodo-grafico', 'Últimos 7 dias');
        set('rel-sub-periodo',           'Dados dos últimos 7 dias.');
    } else if (tipo === 'mes') {
        ini.setDate(ini.getDate() - 29);
        set('rel-label-periodo-grafico', 'Últimos 30 dias');
        set('rel-sub-periodo',           'Dados dos últimos 30 dias.');
    } else if (tipo === 'ano') {
        ini.setFullYear(ini.getFullYear() - 1);
        set('rel-label-periodo-grafico', 'Últimos 12 meses');
        set('rel-sub-periodo',           'Dados dos últimos 12 meses.');
    }

    _dInicio = ini;
    _dFim    = fim;
    _renderGrafico();
    _renderTabela();
}

export function aplicarPersonalizado() {
    const vi = document.getElementById('rel-data-inicio')?.value;
    const vf = document.getElementById('rel-data-fim')?.value;
    if (!vi || !vf) return;
    _dInicio = new Date(vi + 'T00:00:00');
    _dFim    = new Date(vf + 'T23:59:59');
    if (_dInicio > _dFim) return;
    const fmt = d => d.toLocaleDateString('pt-BR');
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('rel-label-periodo-grafico', `${fmt(_dInicio)} – ${fmt(_dFim)}`);
    set('rel-sub-periodo',           `Dados de ${fmt(_dInicio)} até ${fmt(_dFim)}.`);
    _renderGrafico();
    _renderTabela();
}

// ── Contagem de eventos ───────────────────────────────
function _contarEventos(key, ini, fim) {
    if (key === 'avaliacao') {
        if (!ini) return _avaliacoesCache.length;
        return _avaliacoesCache.filter(e => { const d = new Date(e.created_at); return d >= ini && d <= fim; }).length;
    }
    const arr = _eventosCache.filter(e => e.evento_tipo === key);
    if (!ini) return arr.length;
    return arr.filter(e => { const d = new Date(e.created_at); return d >= ini && d <= fim; }).length;
}

function _getEventosFiltrados(key) {
    if (!_dInicio || !_dFim) return [];
    if (key === 'avaliacao') {
        return _avaliacoesCache.filter(e => { const d = new Date(e.created_at); return d >= _dInicio && d <= _dFim; });
    }
    return _eventosCache.filter(e => {
        const d = new Date(e.created_at);
        return e.evento_tipo === key && d >= _dInicio && d <= _dFim;
    });
}

// ── Agrupamento por tempo ─────────────────────────────
function _getGranularidade() {
    if (!_dInicio || !_dFim) return 'dia';
    const dias = Math.round((_dFim - _dInicio) / (1000*3600*24));
    return dias <= 62 ? 'dia' : 'mes';
}

function _agruparEventos(eventos) {
    const gran = _getGranularidade();
    const buckets = {};
    const labelsRaw = [];

    if (gran === 'dia') {
        const d = new Date(_dInicio); d.setHours(0,0,0,0);
        const fim2 = new Date(_dFim); fim2.setHours(23,59,59,999);
        while (d <= fim2) {
            const key = d.toISOString().slice(0,10);
            buckets[key] = 0; labelsRaw.push(key);
            d.setDate(d.getDate() + 1);
        }
        eventos.forEach(e => { const k = (e.created_at||'').slice(0,10); if (k in buckets) buckets[k]++; });
    } else {
        const d = new Date(_dInicio); d.setDate(1); d.setHours(0,0,0,0);
        while (d <= _dFim) {
            const key = d.toISOString().slice(0,7);
            buckets[key] = 0; labelsRaw.push(key);
            d.setMonth(d.getMonth() + 1);
        }
        eventos.forEach(e => { const k = (e.created_at||'').slice(0,7); if (k in buckets) buckets[k]++; });
    }

    const dados  = labelsRaw.map(l => buckets[l] || 0);
    const labels = labelsRaw.map(l => {
        if (gran === 'dia') { const p = l.split('-'); return `${p[2]}/${p[1]}`; }
        const p = l.split('-'); return MESES_PT[parseInt(p[1]) - 1];
    });
    return { labels, dados };
}

// ── Gráfico ───────────────────────────────────────────
function _renderGrafico() {
    if (!_dInicio || !_dFim) return;
    const m       = METRICAS.find(x => x.key === _metricaAtiva) || METRICAS[0];
    const eventos = _getEventosFiltrados(_metricaAtiva);
    const { labels, dados } = _agruparEventos(eventos);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('rel-titulo-grafico', m.icon + ' ' + m.label);

    if (_chart) {
        _chart.data.labels = labels;
        _chart.data.datasets[0].data  = dados;
        _chart.data.datasets[0].borderColor     = m.color;
        _chart.data.datasets[0].backgroundColor = m.color + '14';
        _chart.data.datasets[0].pointBackgroundColor = m.color;
        _chart.data.datasets[0].label = m.label;
        _chart.options.plugins.tooltip.callbacks.label = ctx => ` ${ctx.parsed.y} ${m.label.toLowerCase()}`;
        _chart.update('active');
        return;
    }

    const canvas = document.getElementById('rel-grafico');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    _chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: m.label, data: dados,
                borderColor: m.color, backgroundColor: m.color + '14',
                borderWidth: 2.5, pointBackgroundColor: m.color,
                pointRadius: labels.length <= 31 ? 4 : 2,
                pointHoverRadius: 7, fill: true, tension: 0.4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0d0d0d', titleColor: '#fff', bodyColor: '#ccc',
                    padding: 12, cornerRadius: 10,
                    callbacks: { label: ctx => ` ${ctx.parsed.y} ${m.label.toLowerCase()}` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#bbb', font: { size: 11 }, maxTicksLimit: 14 }, border: { display: false } },
                y: { grid: { color: '#f5f5f5' }, ticks: { color: '#bbb', font: { size: 11 } }, border: { display: false }, beginAtZero: true }
            }
        }
    });
}

// ── Tabela de métricas ────────────────────────────────
function _renderTabela() {
    if (!_dInicio || !_dFim) return;
    const dias   = Math.max(1, Math.round((_dFim - _dInicio) / (1000*3600*24)) + 1);
    const totais = METRICAS.map(m => ({ ...m, total: _contarEventos(m.key, _dInicio, _dFim) }));
    const maxTotal = Math.max(1, ...totais.map(t => t.total));

    const tbody = document.getElementById('rel-tbody-metricas');
    if (!tbody) return;
    tbody.innerHTML = totais.map(t => {
        const media = (t.total / dias).toFixed(1);
        const pct   = Math.round((t.total / maxTotal) * 100);
        return `<tr>
            <td>
                <div class="td-metrica-cell">
                    <div class="icone-m-wrap" style="background:${t.color}18;"><span>${t.icon}</span></div>
                    <span class="nome-m">${t.label}</span>
                </div>
            </td>
            <td class="td-total">${t.total.toLocaleString('pt-BR')}</td>
            <td class="td-media">${media}</td>
            <td class="td-barra">
                <div class="barra-tabela">
                    <div class="barra-tabela-fill" style="width:${pct}%;background:${t.color};"></div>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ── Ranking ───────────────────────────────────────────
async function _renderRanking() {
    const container = document.getElementById('rel-ranking-content');
    if (!container) return;
    if (!_propId || !_propTipo || !_propCidade) {
        container.innerHTML = `<div class="ranking-sem-dados"><p>Configure sua propriedade para ver seu ranking.</p></div>`;
        return;
    }
    try {
        const { data: propsRanking } = await sb.from('propriedades')
            .select('id').eq('tipo_propriedade', _propTipo).eq('cidade', _propCidade);
        const ids = (propsRanking || []).map(p => p.id);
        if (!ids.length) { container.innerHTML = `<div class="ranking-sem-dados"><p>Sem dados de ranking ainda.</p></div>`; return; }

        const { data: viewsData } = await sb.from('analytics_eventos')
            .select('propriedade_id').in('propriedade_id', ids).eq('evento_tipo', 'view');

        const viewsPorProp = {};
        ids.forEach(id => { viewsPorProp[id] = 0; });
        (viewsData||[]).forEach(e => { if (e.propriedade_id in viewsPorProp) viewsPorProp[e.propriedade_id]++; });

        const ranking  = Object.entries(viewsPorProp).sort((a,b) => b[1]-a[1]);
        const idx      = ranking.findIndex(([id]) => String(id) === String(_propId));
        const posicao  = idx === -1 ? null : idx + 1;
        const total    = ranking.length;
        const meuTotal = viewsPorProp[_propId] || viewsPorProp[String(_propId)] || 0;

        let trofeu = '🏆';
        if (posicao === 1) trofeu = '🥇'; else if (posicao === 2) trofeu = '🥈'; else if (posicao === 3) trofeu = '🥉';
        const dica = posicao === 1
            ? '🎉 Parabéns! Você está em <strong>1º lugar</strong> na sua categoria e cidade!'
            : posicao !== null && posicao <= 3
            ? '💪 Ótima posição! Continue atualizando seu espaço para manter o ranking.'
            : '💡 Adicione mais fotos e complete os dados do seu espaço para subir no ranking.';

        container.innerHTML = `
            <div class="ranking-posicao">
                <div class="trofeu-grande">${trofeu}</div>
                <div class="ranking-texto">
                    <h4>${_propTipo} em ${_propCidade}</h4>
                    <div class="ranking-numero"><em>${posicao !== null ? '#' + posicao : '—'}</em></div>
                    <p>de ${total} espaço${total !== 1 ? 's' : ''} — ${meuTotal.toLocaleString('pt-BR')} visualizações</p>
                </div>
            </div>
            <div class="divisor"></div>
            <div class="dica-ranking">${dica}</div>`;
    } catch(_) {
        container.innerHTML = `<div class="ranking-sem-dados"><p>Não foi possível carregar o ranking.</p></div>`;
    }
}

// ── Buscas populares ──────────────────────────────────
async function _renderBuscasPopulares() {
    const container = document.getElementById('rel-tendencias-content');
    if (!container) return;
    try {
        const { data, error } = await sb.from('buscas').select('tipo_evento').not('tipo_evento','is',null).neq('tipo_evento','');
        if (error) throw error;
        const contagem = {};
        (data||[]).forEach(b => { if (b.tipo_evento) { const n = b.tipo_evento.trim(); if (n) contagem[n] = (contagem[n]||0)+1; } });
        const sorted = Object.entries(contagem).sort((a,b) => b[1]-a[1]).slice(0,7);
        const totalGeral = Math.max(1, sorted.reduce((acc,[,v]) => acc+v, 0));
        const maxVal     = Math.max(1, sorted[0]?.[1] || 1);
        if (!sorted.length) { container.innerHTML = `<p style="color:#bbb;font-size:0.85rem;">Sem dados de buscas disponíveis.</p>`; return; }
        container.innerHTML = sorted.map(([nome, count]) => {
            const pct = Math.round((count / totalGeral) * 100);
            return `<div class="barra-tendencia">
                <div class="label-tendencia"><strong>${nome}</strong><span>${pct}%</span></div>
                <div class="barra-track">
                    <div class="barra-fill" data-width="${Math.round((count/maxVal)*100)}%"></div>
                </div>
            </div>`;
        }).join('');
        setTimeout(() => {
            container.querySelectorAll('.barra-fill').forEach(el => { el.style.width = el.dataset.width; });
        }, 400);
    } catch(_) {
        container.innerHTML = `<p style="color:#bbb;font-size:0.85rem;">Sem dados disponíveis.</p>`;
    }
}
