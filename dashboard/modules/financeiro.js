// ─────────────────────────────────────────
//  VENTSY — Módulo: Financeiro
//  Contém toda a lógica da seção financeiro
// ─────────────────────────────────────────
import { mostrarToast } from '../js/ui.js';

// ── Dados mock (substituir por Supabase futuramente) ─
const finTransactions = [
    { data:'15/06', desc:'Casamento Silva — Salão Principal', cat:'Aluguel de Espaço', tipo_evt:'Casamento',  status:'pago',     valor:12000, tipo:'receita' },
    { data:'14/06', desc:'Decoração Festa 15 Anos',           cat:'Decoração',         tipo_evt:'Aniversário',status:'pago',     valor:2800,  tipo:'receita' },
    { data:'13/06', desc:'Manutenção Ar-condicionado',        cat:'Manutenção',         tipo_evt:'—',          status:'pago',     valor:-850,  tipo:'despesa' },
    { data:'12/06', desc:'Formatura Engenharia UFRJ',         cat:'Aluguel de Espaço', tipo_evt:'Formatura',  status:'pendente', valor:8500,  tipo:'receita' },
    { data:'11/06', desc:'Buffet Corporativo TechConf',       cat:'Buffet / Catering', tipo_evt:'Corporativo',status:'pago',     valor:5200,  tipo:'receita' },
    { data:'10/06', desc:'Serviço de Limpeza Semanal',        cat:'Limpeza',           tipo_evt:'—',          status:'pago',     valor:-600,  tipo:'despesa' },
    { data:'09/06', desc:'Aniversário Martins — Jardim',      cat:'Aluguel de Espaço', tipo_evt:'Aniversário',status:'pago',     valor:6800,  tipo:'receita' },
    { data:'08/06', desc:'Material de Manutenção',            cat:'Manutenção',         tipo_evt:'—',          status:'pendente', valor:-1200, tipo:'despesa' },
    { data:'07/06', desc:'Workshop de Culinária',             cat:'Aluguel de Espaço', tipo_evt:'Corporativo',status:'pago',     valor:3400,  tipo:'receita' },
    { data:'06/06', desc:'Conta de Energia Elétrica',         cat:'Outros',            tipo_evt:'—',          status:'atrasado', valor:-2100, tipo:'despesa' },
];

const finDonutData = [
    { label:'Aluguel de Espaço', value:30500, color:'#ff385c' },
    { label:'Buffet / Catering', value:9200,  color:'#0ca678' },
    { label:'Decoração',         value:4800,  color:'#f59e0b' },
    { label:'Som / Iluminação',  value:3200,  color:'#1a73e8' },
    { label:'Outros',            value:1000,  color:'#bbb'    },
];

const finGoals = [
    { name:'Meta de Receita',  current:48700, target:60000, color:'#0ca678', fmt:'R$' },
    { name:'Nº de Eventos',    current:14,    target:20,    color:'#1a73e8', fmt:'n'  },
    { name:'Reduzir Despesas', current:8650,  target:8000,  color:'#ff385c', fmt:'R$' },
    { name:'Taxa de Ocupação', current:72,    target:85,    color:'#f59e0b', fmt:'%'  },
];

const finUpcomingEvents = [
    { day:'22', mon:'Jun', name:'Casamento Ferreira', type:'Salão Principal — 200 pax', val:'R$ 15.000' },
    { day:'25', mon:'Jun', name:'Formatura Medicina',  type:'Jardim + Salão — 300 pax',  val:'R$ 9.500' },
    { day:'28', mon:'Jun', name:'Aniversário 50 Anos', type:'Salão Íntimo — 80 pax',     val:'R$ 5.800' },
];

// ── Init (chamado pelo router na primeira visita) ────
export function init() {
    finDrawBarChart();
    finDrawDonut();
    finRenderGoals();
    finRenderEvents();
    finRenderTable();
    const el = document.getElementById('fin-data-atual');
    if (el) el.textContent = new Date().toLocaleDateString('pt-BR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    window.addEventListener('resize', () => {
        finDrawBarChart();
        finDrawDonut();
    });

    // Expor funções para o HTML inline (onclick=)
    _exposeGlobals();
}

// ── Expor funções como globais para o HTML ──────────
// Necessário enquanto o HTML usa onclick= direto
function _exposeGlobals() {
    window.finMudarAba       = finMudarAba;
    window.finOpenModal      = finOpenModal;
    window.finCloseModal     = finCloseModal;
    window.finSaveTransaction = finSaveTransaction;
    window.finFilterTable    = finFilterTable;
    window.finUpdatePeriod   = finUpdatePeriod;
}

// ── Abas ────────────────────────────────────────────
export function finMudarAba(id, btn) {
    document.querySelectorAll('.fin-tab-btn').forEach(b => b.classList.remove('ativo'));
    document.querySelectorAll('.fin-tab-content').forEach(c => c.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.getElementById('fin-' + id)?.classList.add('ativo');

    if (id === 'receitas') _finRenderFilteredTable('finReceitasTable', 'receita');
    if (id === 'despesas') _finRenderFilteredTable('finDespesasTable', 'despesa');
    if (id === 'eventos')  _finRenderEventListFull();
    if (id === 'relatorios') _finRenderGoalsById('finGoalListRel');
}

// ── Gráfico de barras (Canvas) ───────────────────────
function finDrawBarChart() {
    const canvas = document.getElementById('finBarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth || 400;
    const H   = 160;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const months   = ['Jan','Fev','Mar','Abr','Mai','Jun'];
    const receitas = [32000,41000,37500,44000,52000,48700];
    const despesas = [14000,16000,15500,17000,21000,19350];
    const maxVal   = Math.max(...receitas, ...despesas);
    const barW     = (W / months.length) * 0.38;
    const gutter   = (W / months.length) - barW * 2 - 4;

    months.forEach((m, i) => {
        const x  = (W / months.length) * i + gutter / 2 + 4;
        const hR = (receitas[i] / maxVal) * (H - 28);
        const hD = (despesas[i] / maxVal) * (H - 28);

        ctx.fillStyle = '#0ca678';
        ctx.beginPath();
        _roundRect(ctx, x, H - 20 - hR, barW, hR, 4);
        ctx.fill();

        ctx.fillStyle = '#ff385c';
        ctx.beginPath();
        _roundRect(ctx, x + barW + 4, H - 20 - hD, barW, hD, 4);
        ctx.fill();

        ctx.fillStyle = '#999';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(m, x + barW + 2, H - 4);
    });

    ctx.font = '10px Arial'; ctx.textAlign = 'left';
    ctx.fillStyle = '#0ca678'; ctx.fillRect(0, 2, 10, 10);
    ctx.fillStyle = '#999';    ctx.fillText('Receita', 14, 11);
    ctx.fillStyle = '#ff385c'; ctx.fillRect(75, 2, 10, 10);
    ctx.fillStyle = '#999';    ctx.fillText('Despesa', 89, 11);
}

function _roundRect(ctx, x, y, w, h, r) {
    if (h <= 0) return;
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h); ctx.lineTo(x, y+h);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
}

// ── Donut ────────────────────────────────────────────
function finDrawDonut() {
    const canvas = document.getElementById('finDonutChart');
    if (!canvas) return;
    const ctx   = canvas.getContext('2d');
    const size  = 140;
    const dpr   = window.devicePixelRatio || 1;
    canvas.width = size * dpr; canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const cx = size/2, cy = size/2, r = 54, inner = 32;
    const total = finDonutData.reduce((s,d) => s + d.value, 0);
    let angle = -Math.PI / 2;

    finDonutData.forEach(d => {
        const sweep = (d.value / total) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, angle + sweep);
        ctx.closePath(); ctx.fillStyle = d.color; ctx.globalAlpha = 0.9; ctx.fill();
        angle += sweep;
    });
    ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 1; ctx.fill();
    ctx.fillStyle = '#0d0d0d'; ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center'; ctx.fillText('R$ 48,7k', cx, cy + 4);

    const legend = document.getElementById('finDonutLegend');
    if (!legend) return;
    legend.innerHTML = '';
    finDonutData.forEach(d => {
        const pct = ((d.value / total) * 100).toFixed(0);
        legend.innerHTML += `
          <div class="fin-legend-item">
            <div class="fin-legend-dot" style="background:${d.color}"></div>
            <span class="fin-legend-name">${d.label}</span>
            <span class="fin-legend-val" style="color:${d.color}">R$ ${d.value.toLocaleString('pt-BR')}</span>
            <span class="fin-legend-pct">${pct}%</span>
          </div>`;
    });
}

// ── Metas ────────────────────────────────────────────
function finRenderGoals() { _finRenderGoalsById('finGoalList'); }
function _finRenderGoalsById(elId) {
    const list = document.getElementById(elId);
    if (!list) return;
    list.innerHTML = '';
    finGoals.forEach(g => {
        const pct  = Math.min(100, Math.round((g.current / g.target) * 100));
        const fmt  = g.fmt==='n' ? g.current : g.fmt==='%' ? g.current+'%' : 'R$ '+g.current.toLocaleString('pt-BR');
        const fmtT = g.fmt==='n' ? g.target  : g.fmt==='%' ? g.target+'%'  : 'R$ '+g.target.toLocaleString('pt-BR');
        list.innerHTML += `
          <div class="fin-goal-item">
            <div class="fin-goal-top"><span class="fin-goal-name">${g.name}</span><span class="fin-goal-nums">${fmt} / ${fmtT} (${pct}%)</span></div>
            <div class="fin-progress-track"><div class="fin-progress-fill" style="width:0%;background:${g.color}" data-width="${pct}%"></div></div>
          </div>`;
    });
    setTimeout(() => {
        list.querySelectorAll('.fin-progress-fill').forEach(el => { el.style.width = el.dataset.width; });
    }, 300);
}

// ── Eventos ──────────────────────────────────────────
function finRenderEvents() {
    const list = document.getElementById('finEventList');
    if (!list) return;
    list.innerHTML = finUpcomingEvents.map(e => _eventItemHTML(e)).join('');
}
function _finRenderEventListFull() {
    const list = document.getElementById('finEventListFull');
    if (!list) return;
    list.innerHTML = finUpcomingEvents.map(e => _eventItemHTML(e)).join('');
}
function _eventItemHTML(e) {
    return `<div class="fin-event-item">
      <div class="fin-event-date"><div class="fin-event-day">${e.day}</div><div class="fin-event-mon">${e.mon}</div></div>
      <div class="fin-event-info"><div class="fin-event-name">${e.name}</div><div class="fin-event-type">${e.type}</div></div>
      <div class="fin-event-val">${e.val}</div>
    </div>`;
}

// ── Tabela ────────────────────────────────────────────
function finRenderTable(filter = 'todos') {
    const tbody = document.getElementById('finTransTable');
    if (!tbody) return;
    const filtered =
        filter === 'receita'  ? finTransactions.filter(t => t.tipo === 'receita')  :
        filter === 'despesa'  ? finTransactions.filter(t => t.tipo === 'despesa')  :
        filter === 'pendente' ? finTransactions.filter(t => t.status === 'pendente') :
        finTransactions;
    _fillRows(tbody, filtered);
}
function _finRenderFilteredTable(tbodyId, tipo) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    _fillRows(tbody, finTransactions.filter(t => t.tipo === tipo));
}
function _fillRows(tbody, rows) {
    tbody.innerHTML = rows.map(t => {
        const cls = t.valor > 0 ? 'fin-amount-in' : 'fin-amount-out';
        const str = (t.valor > 0 ? '+' : '') + 'R$ ' + Math.abs(t.valor).toLocaleString('pt-BR');
        return `<tr>
          <td style="color:#999;font-size:0.78rem">${t.data}</td>
          <td style="font-weight:600;color:#222">${t.desc}</td>
          <td style="color:#999;font-size:0.78rem">${t.cat}</td>
          <td style="color:#999;font-size:0.78rem">${t.tipo_evt}</td>
          <td><span class="fin-status ${t.status}"><span class="fin-dot"></span>${t.status.charAt(0).toUpperCase()+t.status.slice(1)}</span></td>
          <td style="text-align:right"><span class="${cls}">${str}</span></td>
        </tr>`;
    }).join('');
}
export function finFilterTable(v) { finRenderTable(v); }

// ── Modal de lançamento ───────────────────────────────
export function finOpenModal(type) {
    const titles = { receita:'Nova Receita', despesa:'Nova Despesa', meta:'Editar Metas' };
    const el = document.getElementById('fin-modal-title');
    if (el) el.textContent = titles[type] || 'Novo Lançamento';
    const desc = document.getElementById('fin-modal-desc');
    if (desc) desc.textContent = 'Registre a movimentação financeira abaixo.';
    const tipo = document.getElementById('fin-f-tipo');
    if (tipo && (type === 'receita' || type === 'despesa')) tipo.value = type;
    const data = document.getElementById('fin-f-data');
    if (data) data.value = new Date().toISOString().split('T')[0];
    document.getElementById('finModal')?.classList.add('open');
}
export function finCloseModal() {
    document.getElementById('finModal')?.classList.remove('open');
}

export function finSaveTransaction() {
    const tipo   = document.getElementById('fin-f-tipo')?.value;
    const data   = document.getElementById('fin-f-data')?.value;
    const valor  = parseFloat(document.getElementById('fin-f-valor')?.value) || 0;
    const desc   = document.getElementById('fin-f-desc')?.value || 'Sem descrição';
    const cat    = document.getElementById('fin-f-cat')?.value;
    const status = document.getElementById('fin-f-status')?.value;

    const d  = new Date(data);
    const dd = String(d.getDate()+1).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
    finTransactions.unshift({ data:dd, desc, cat, tipo_evt:'—', status, valor: tipo==='receita' ? valor : -valor, tipo });

    const recTotal  = finTransactions.filter(t => t.tipo==='receita').reduce((s,t) => s+t.valor, 0);
    const despTotal = finTransactions.filter(t => t.tipo==='despesa').reduce((s,t) => s+Math.abs(t.valor), 0);
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setVal('fin-kpi-receita', 'R$ '+recTotal.toLocaleString('pt-BR'));
    setVal('fin-kpi-despesa', 'R$ '+despTotal.toLocaleString('pt-BR'));
    setVal('fin-kpi-lucro',   'R$ '+(recTotal-despTotal).toLocaleString('pt-BR'));

    finRenderTable();
    finCloseModal();
    mostrarToast('Lançamento registrado!');
}

// ── Período ───────────────────────────────────────────
export function finUpdatePeriod(v) {
    const mult = v==='trimestre' ? 3 : v==='ano' ? 12 : 1;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setVal('fin-kpi-receita', 'R$ '+(48700*mult).toLocaleString('pt-BR'));
    setVal('fin-kpi-despesa', 'R$ '+(19350*mult).toLocaleString('pt-BR'));
    setVal('fin-kpi-lucro',   'R$ '+(29350*mult).toLocaleString('pt-BR'));
    setVal('fin-kpi-eventos', (14*mult).toString());
}
