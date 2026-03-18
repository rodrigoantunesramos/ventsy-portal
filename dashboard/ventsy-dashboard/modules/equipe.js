// ─────────────────────────────────────────
//  VENTSY — Módulo: Equipe & Folha de Pagamento
// ─────────────────────────────────────────
import { mostrarToast } from '../js/ui.js';

// ── Constantes ───────────────────────────────────────
const EQ_MONTHS       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const eqAvatarColors  = ['#0ca678','#f59e0b','#ff385c','#8b5cf6','#1a73e8','#22c55e','#fb923c','#e879f9'];
const eqContractLabel = { clt:'CLT', horista:'Horista', mei:'MEI', estagio:'Estágio' };
const eqStatusLabel   = { ativo:'Ativo', ferias:'Férias', afas:'Afastado', horista:'Horista' };
const eqStatusClass   = { ativo:'eq-pill-ativo', ferias:'eq-pill-ferias', afas:'eq-pill-afas', horista:'eq-pill-horista' };

// ── Estado do módulo ─────────────────────────────────
let employees = [
    { id:1, nome:'Ana Lima',           cargo:'Coordenadora de Eventos',   dept:'Operações',      salario:4200, contrato:'clt',  status:'ativo',   admissao:'2021-03-15', tel:'(31) 99111-1111', obs:'' },
    { id:2, nome:'Bruno Souza',        cargo:'Garçom Senior',             dept:'Operações',      salario:1980, contrato:'clt',  status:'ativo',   admissao:'2022-07-01', tel:'(31) 99222-2222', obs:'' },
    { id:3, nome:'Carla Mendes',       cargo:'Auxiliar de Limpeza',       dept:'Limpeza',        salario:1518, contrato:'clt',  status:'ferias',  admissao:'2020-11-10', tel:'(31) 99333-3333', obs:'Férias até 10/04' },
    { id:4, nome:'Diego Ferreira',     cargo:'Segurança Patrimonial',     dept:'Segurança',      salario:2200, contrato:'clt',  status:'ativo',   admissao:'2023-01-20', tel:'(31) 99444-4444', obs:'' },
    { id:5, nome:'Eliane Costa',       cargo:'Cozinheira',                dept:'Cozinha/Buffet', salario:2600, contrato:'clt',  status:'ativo',   admissao:'2021-09-05', tel:'(31) 99555-5555', obs:'' },
    { id:6, nome:'Fábio Alves',        cargo:'DJ / Sonorização',          dept:'Operações',      salario:0,    contrato:'mei',  status:'horista', admissao:'2022-04-01', tel:'(31) 99666-6666', obs:'Valor por evento: R$ 800' },
    { id:7, nome:'Gabriela Nunes',     cargo:'Decoradora',                dept:'Decoração',      salario:2800, contrato:'clt',  status:'ativo',   admissao:'2023-06-15', tel:'(31) 99777-7777', obs:'' },
    { id:8, nome:'Heitor Ramos',       cargo:'Assistente Administrativo', dept:'Administração',  salario:1900, contrato:'clt',  status:'ativo',   admissao:'2024-02-01', tel:'(31) 99888-8888', obs:'' },
];
let eqNextId     = 9;
let eqEditingId  = null;
let eqFilterStatus = 'todos';
let eqSearchTerm = '';
let eqMonthOffset = 0;

let eqTaxes = {
    inssPat:20, fgts:8, rat:2, sisS:3.1, outrosPat:0,
    inssEmp:9, irrf:7.5, vt:6, ps:0, outrosDesc:0,
    vr:550, vtEmp:220, psEmp:0, outrosBen:0,
    dec:8.33, fer:11.11, multa:3.2, outrosProv:0,
};

// ── Init ─────────────────────────────────────────────
export function init() {
    eqUpdateTax();
    eqRenderEmployees();
    eqRenderPayroll();
    eqUpdateKPIs();
    _exposeGlobals();
}

function _exposeGlobals() {
    window.eqOpenEmpModal   = eqOpenEmpModal;
    window.eqCloseEmpModal  = eqCloseEmpModal;
    window.eqSaveEmployee   = eqSaveEmployee;
    window.eqDeleteEmp      = eqDeleteEmp;
    window.eqOpenPayDetail  = eqOpenPayDetail;
    window.eqUpdateTax      = eqUpdateTax;
    window.eqRunSimulator   = eqRunSimulator;
    window.eqFilterStatus   = eqSetFilter;
    window.eqSearchEmp      = eqSearchEmp;
    window.eqChangeMonth    = eqChangeMonth;
    window.eqMudarAba       = eqMudarAba;
}

// ── Helpers ───────────────────────────────────────────
function eqFmtBRL(v)    { return 'R$ ' + v.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function eqFmtDate(d)   { if (!d) return '—'; const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; }
function eqInitials(n)  { return n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
function eqAvatarColor(id) { return eqAvatarColors[(id-1) % eqAvatarColors.length]; }

// ── Cálculo salarial ──────────────────────────────────
function eqCalcSalary(emp, bonus=0, heQty=0) {
    const base = emp.salario;
    if (emp.contrato === 'mei') return { bruto:base+bonus, liquido:base+bonus, descontos:0, custoEmpresa:base+bonus, breakdown:[] };

    const heVal = heQty > 0 ? ((base/220)*1.5*heQty) : 0;
    const bruto = base + heVal + bonus;

    const inssEmpVal = bruto * (eqTaxes.inssEmp/100);
    const irrfVal    = (bruto - inssEmpVal) * (eqTaxes.irrf/100);
    const vtDesc     = bruto * (eqTaxes.vt/100);
    const psDesc     = eqTaxes.ps;
    const outrosDescVal = bruto * (eqTaxes.outrosDesc/100);
    const totalDesc  = inssEmpVal + irrfVal + vtDesc + psDesc + outrosDescVal;
    const liquido    = bruto - totalDesc;

    const encPat  = bruto * ((eqTaxes.inssPat+eqTaxes.fgts+eqTaxes.rat+eqTaxes.sisS+eqTaxes.outrosPat)/100);
    const benefEmp = eqTaxes.vr + eqTaxes.vtEmp + eqTaxes.psEmp + eqTaxes.outrosBen;
    const provPct  = (eqTaxes.dec+eqTaxes.fer+eqTaxes.multa+eqTaxes.outrosProv)/100;
    const provVal  = bruto * provPct;
    const custoEmpresa = bruto + encPat + benefEmp + provVal;

    const breakdown = [
        { name:'Salário Base',       val: base,          type:'neutral' },
        ...(heVal>0 ? [{ name:`Horas Extras (${heQty}h)`, val: heVal, type:'add' }] : []),
        ...(bonus>0 ? [{ name:'Bônus',                     val: bonus, type:'add' }] : []),
        { name:'INSS (empregado)',    val: -inssEmpVal,   type:'ded' },
        { name:'IRRF',                val: -irrfVal,      type:'ded' },
        { name:'Vale-Transporte',     val: -vtDesc,       type:'ded' },
        ...(psDesc>0  ? [{ name:'Plano de Saúde',          val: -psDesc,  type:'ded' }] : []),
    ];

    return { bruto, liquido, descontos: totalDesc, custoEmpresa, breakdown };
}

// ── KPIs ──────────────────────────────────────────────
export function eqUpdateKPIs() {
    const ativos = employees.filter(e => e.status !== 'horista' && e.contrato !== 'mei');
    const totalBruto = ativos.reduce((s,e) => s + eqCalcSalary(e).bruto, 0);
    const totalLiq   = ativos.reduce((s,e) => s + eqCalcSalary(e).liquido, 0);
    const totalCusto = ativos.reduce((s,e) => s + eqCalcSalary(e).custoEmpresa, 0);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('eq-kpi-total',  employees.length);
    set('eq-kpi-ativos', employees.filter(e => e.status === 'ativo').length);
    set('eq-kpi-folha',  eqFmtBRL(totalBruto));
    set('eq-kpi-custo',  eqFmtBRL(totalCusto));
}

// ── Render funcionários ───────────────────────────────
export function eqRenderEmployees() {
    const list = employees.filter(e => {
        const statusMatch = eqFilterStatus === 'todos' || e.status === eqFilterStatus || e.contrato === eqFilterStatus;
        const q = eqSearchTerm.toLowerCase();
        const srch = !q || e.nome.toLowerCase().includes(q) || e.cargo.toLowerCase().includes(q) || e.dept.toLowerCase().includes(q);
        return statusMatch && srch;
    });

    const grid = document.getElementById('eq-emp-grid');
    if (!grid) return;

    if (list.length === 0) {
        grid.innerHTML = `<div class="eq-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg><h3>Nenhum funcionário encontrado</h3><p>Ajuste os filtros ou cadastre um novo colaborador.</p></div>`;
        return;
    }

    grid.innerHTML = list.map(e => {
        const calc = eqCalcSalary(e);
        return `
          <div class="eq-emp-card">
            <div class="eq-emp-head">
              <div class="eq-emp-avatar" style="background:${eqAvatarColor(e.id)}">${eqInitials(e.nome)}</div>
              <div class="eq-emp-info">
                <div class="eq-emp-nome">${e.nome}</div>
                <div class="eq-emp-cargo">${e.cargo}</div>
                <div class="eq-emp-dept">🏢 ${e.dept}</div>
              </div>
              <span class="eq-pill ${eqStatusClass[e.status]||'eq-pill-ativo'}">${eqStatusLabel[e.status]||e.status}</span>
            </div>
            <div class="eq-emp-stats">
              <div class="eq-emp-stat"><div class="eq-emp-stat-label">Contrato</div><div class="eq-emp-stat-val">${eqContractLabel[e.contrato]||e.contrato}</div></div>
              <div class="eq-emp-stat"><div class="eq-emp-stat-label">Salário Bruto</div><div class="eq-emp-stat-val" style="color:#0ca678">${eqFmtBRL(calc.bruto)}</div></div>
              <div class="eq-emp-stat"><div class="eq-emp-stat-label">Sal. Líquido</div><div class="eq-emp-stat-val">${eqFmtBRL(calc.liquido)}</div></div>
              <div class="eq-emp-stat"><div class="eq-emp-stat-label">Custo Total</div><div class="eq-emp-stat-val" style="color:#f59e0b">${eqFmtBRL(calc.custoEmpresa)}</div></div>
              <div class="eq-emp-stat"><div class="eq-emp-stat-label">Admissão</div><div class="eq-emp-stat-val">${eqFmtDate(e.admissao)}</div></div>
              <div class="eq-emp-stat"><div class="eq-emp-stat-label">WhatsApp</div><div class="eq-emp-stat-val">${e.tel||'—'}</div></div>
            </div>
            ${e.obs ? `<div class="eq-emp-obs">💬 ${e.obs}</div>` : ''}
            <div class="eq-emp-foot">
              <button class="eq-emp-action" onclick="eqOpenPayDetail(${e.id})">💰 Contracheque</button>
              <div class="eq-emp-sep"></div>
              <button class="eq-emp-action" onclick="eqOpenEmpModal(${e.id})">✏️ Editar</button>
              <div class="eq-emp-sep"></div>
              <button class="eq-emp-action danger" onclick="eqDeleteEmp(${e.id})">🗑️ Excluir</button>
            </div>
          </div>`;
    }).join('');
}

// ── Folha de pagamento ────────────────────────────────
export function eqRenderPayroll() {
    const now = new Date();
    const month = (now.getMonth() + eqMonthOffset + 12) % 12;
    const year  = now.getFullYear() + Math.floor((now.getMonth() + eqMonthOffset) / 12);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('eq-payroll-month', EQ_MONTHS[month] + ' ' + year);

    const ativos = employees.filter(e => e.status !== 'afas');
    const totalBruto  = ativos.reduce((s,e) => s + eqCalcSalary(e).bruto, 0);
    const totalLiq    = ativos.reduce((s,e) => s + eqCalcSalary(e).liquido, 0);
    const totalCusto  = ativos.reduce((s,e) => s + eqCalcSalary(e).custoEmpresa, 0);

    set('eq-pr-bruto', eqFmtBRL(totalBruto));
    set('eq-pr-liquido', eqFmtBRL(totalLiq));
    set('eq-pr-custo', eqFmtBRL(totalCusto));

    const tbody = document.getElementById('eq-payroll-tbody');
    if (!tbody) return;
    tbody.innerHTML = ativos.map(e => {
        const c = eqCalcSalary(e);
        return `<tr>
          <td><div style="font-weight:600;color:#222">${e.nome}</div><div style="font-size:0.74rem;color:#999">${e.cargo}</div></td>
          <td class="eq-td-mono">${eqContractLabel[e.contrato]}</td>
          <td class="eq-td-mono">${eqFmtBRL(c.bruto)}</td>
          <td class="eq-td-mono eq-td-red">- ${eqFmtBRL(c.descontos)}</td>
          <td class="eq-td-mono eq-td-green">${eqFmtBRL(c.liquido)}</td>
          <td class="eq-td-mono eq-td-amber">${eqFmtBRL(c.custoEmpresa)}</td>
          <td><button class="eq-pay-btn" onclick="eqOpenPayDetail(${e.id})">Ver Detalhes</button></td>
        </tr>`;
    }).join('');
}

export function eqChangeMonth(delta) {
    eqMonthOffset += delta;
    eqRenderPayroll();
}

// ── Encargos ──────────────────────────────────────────
export function eqUpdateTax() {
    const r = id => parseFloat(document.getElementById(id)?.value) || 0;
    eqTaxes.inssPat=r('eq-t-inss-pat'); eqTaxes.fgts=r('eq-t-fgts'); eqTaxes.rat=r('eq-t-rat'); eqTaxes.sisS=r('eq-t-sis-s'); eqTaxes.outrosPat=r('eq-t-outros-pat');
    eqTaxes.inssEmp=r('eq-t-inss-emp'); eqTaxes.irrf=r('eq-t-irrf'); eqTaxes.vt=r('eq-t-vt'); eqTaxes.ps=r('eq-t-ps'); eqTaxes.outrosDesc=r('eq-t-outros-desc');
    eqTaxes.vr=r('eq-t-vr'); eqTaxes.vtEmp=r('eq-t-vt-emp'); eqTaxes.psEmp=r('eq-t-ps-emp'); eqTaxes.outrosBen=r('eq-t-outros-ben');
    eqTaxes.dec=r('eq-t-dec'); eqTaxes.fer=r('eq-t-fer'); eqTaxes.multa=r('eq-t-multa'); eqTaxes.outrosProv=r('eq-t-outros-prov');

    const pct = (id,v) => { const el = document.getElementById(id); if (el) el.textContent = v.toFixed(1)+'%'; };
    const brl = (id,v) => { const el = document.getElementById(id); if (el) el.textContent = 'R$ '+v.toFixed(0); };
    pct('eq-v-inss-pat',eqTaxes.inssPat); pct('eq-v-fgts',eqTaxes.fgts); pct('eq-v-rat',eqTaxes.rat); pct('eq-v-sis-s',eqTaxes.sisS);
    pct('eq-v-inss-emp',eqTaxes.inssEmp); pct('eq-v-irrf',eqTaxes.irrf); pct('eq-v-vt',eqTaxes.vt);
    brl('eq-v-vr',eqTaxes.vr); brl('eq-v-vt-emp',eqTaxes.vtEmp); brl('eq-v-ps-emp',eqTaxes.psEmp);
    pct('eq-v-dec',eqTaxes.dec); pct('eq-v-fer',eqTaxes.fer); pct('eq-v-multa',eqTaxes.multa);

    const totalPat  = eqTaxes.inssPat+eqTaxes.fgts+eqTaxes.rat+eqTaxes.sisS+eqTaxes.outrosPat;
    const totalDesc = eqTaxes.inssEmp+eqTaxes.irrf+eqTaxes.vt+eqTaxes.outrosDesc;
    const totalBen  = eqTaxes.vr+eqTaxes.vtEmp+eqTaxes.psEmp+eqTaxes.outrosBen;
    const totalProv = eqTaxes.dec+eqTaxes.fer+eqTaxes.multa+eqTaxes.outrosProv;
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('eq-total-patronal',  totalPat.toFixed(1)+'%');
    setEl('eq-total-desconto',  totalDesc.toFixed(1)+'%');
    setEl('eq-total-beneficios','R$ '+totalBen.toFixed(0));
    setEl('eq-total-provisoes', totalProv.toFixed(2)+'%');
    eqRunSimulator();
    eqUpdateKPIs();
}

// ── Simulador ─────────────────────────────────────────
export function eqRunSimulator() {
    const base  = parseFloat(document.getElementById('eq-sim-salario')?.value) || 0;
    const tipo  = document.getElementById('eq-sim-tipo')?.value || 'clt';
    const heQty = parseFloat(document.getElementById('eq-sim-he')?.value) || 0;
    const bonus = parseFloat(document.getElementById('eq-sim-bonus')?.value) || 0;
    const calc  = eqCalcSalary({ id:0, nome:'', salario:base, contrato:tipo }, bonus, heQty);

    const encPct  = (eqTaxes.inssPat+eqTaxes.fgts+eqTaxes.rat+eqTaxes.sisS+eqTaxes.outrosPat)/100;
    const provPct = (eqTaxes.dec+eqTaxes.fer+eqTaxes.multa+eqTaxes.outrosProv)/100;
    const benef   = eqTaxes.vr+eqTaxes.vtEmp+eqTaxes.psEmp+eqTaxes.outrosBen;
    const encVal  = calc.bruto * encPct;
    const provVal = calc.bruto * provPct;
    const custoTotal = calc.bruto + encVal + provVal + benef;

    const resEl = document.getElementById('eqSimResult');
    if (!resEl) return;
    resEl.innerHTML = `
      <div style="margin-bottom:14px">
        <div class="eq-sim-liq-label">Salário Líquido do Funcionário</div>
        <div class="eq-sim-liq-val">${eqFmtBRL(calc.liquido)}</div>
      </div>
      <div style="height:1px;background:#eee;margin-bottom:12px"></div>
      ${calc.breakdown.map(r=>`
        <div class="eq-sim-row">
          <span class="eq-sim-name ${r.type==='ded'?'ded':r.type==='add'?'add':''}">${r.name}</span>
          <span class="eq-sim-val ${r.val<0?'neg':r.type==='add'?'pos':''}">${r.val>=0?'+':''}${eqFmtBRL(Math.abs(r.val))}</span>
        </div>`).join('')}
      <div style="height:1px;background:#eee;margin:10px 0 6px"></div>
      ${tipo!=='mei'?`
      <div class="eq-sim-row" style="background:rgba(139,92,246,.06);border-radius:6px;padding:8px 10px;margin-bottom:3px">
        <span class="eq-sim-name" style="color:#8b5cf6">Encargos Patronais (${(eqTaxes.inssPat+eqTaxes.fgts+eqTaxes.rat+eqTaxes.sisS+eqTaxes.outrosPat).toFixed(1)}%)</span>
        <span class="eq-sim-val neg" style="color:#8b5cf6">+ ${eqFmtBRL(encVal)}</span>
      </div>
      <div class="eq-sim-row" style="background:rgba(139,92,246,.06);border-radius:6px;padding:8px 10px;margin-bottom:3px">
        <span class="eq-sim-name" style="color:#8b5cf6">Provisões (${(eqTaxes.dec+eqTaxes.fer+eqTaxes.multa+eqTaxes.outrosProv).toFixed(2)}%)</span>
        <span class="eq-sim-val neg" style="color:#8b5cf6">+ ${eqFmtBRL(provVal)}</span>
      </div>
      <div class="eq-sim-row" style="background:rgba(139,92,246,.06);border-radius:6px;padding:8px 10px;margin-bottom:10px">
        <span class="eq-sim-name" style="color:#8b5cf6">Benefícios (VR + VT + Saúde)</span>
        <span class="eq-sim-val neg" style="color:#8b5cf6">+ ${eqFmtBRL(benef)}</span>
      </div>`:''}
      <div class="eq-sim-row total">
        <span style="font-weight:700;font-size:.88rem;color:#222">Custo Total Empresa / Mês</span>
        <span class="eq-sim-val tot">${eqFmtBRL(custoTotal)}</span>
      </div>`;
}

// ── Abas equipe ───────────────────────────────────────
export function eqMudarAba(id, btn) {
    document.querySelectorAll('.eq-tab-btn').forEach(b => b.classList.remove('ativo'));
    document.querySelectorAll('.eq-tab-content').forEach(c => c.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.getElementById('eq-tab-' + id)?.classList.add('ativo');
}

// ── Filtros ───────────────────────────────────────────
export function eqSetFilter(f) { eqFilterStatus = f; eqRenderEmployees(); }
export function eqSearchEmp(q) { eqSearchTerm = q; eqRenderEmployees(); }

// ── Modal funcionário ─────────────────────────────────
export function eqOpenEmpModal(id) {
    eqEditingId = id || null;
    const e = id ? employees.find(x => x.id === id) : null;
    const set = (sel, v) => { const el = document.getElementById(sel); if (el) el.value = v; };
    document.getElementById('eqEmpModalTitle').textContent = e ? 'Editar Funcionário' : 'Novo Funcionário';
    set('eq-ef-nome',     e?.nome     || '');
    set('eq-ef-cargo',    e?.cargo    || '');
    set('eq-ef-dept',     e?.dept     || 'Operações');
    set('eq-ef-salario',  e?.salario  || 1800);
    set('eq-ef-contrato', e?.contrato || 'clt');
    set('eq-ef-admissao', e?.admissao || new Date().toISOString().split('T')[0]);
    set('eq-ef-status',   e?.status   || 'ativo');
    set('eq-ef-tel',      e?.tel      || '');
    set('eq-ef-obs',      e?.obs      || '');
    document.getElementById('eqEmpModal')?.classList.add('open');
}
export function eqCloseEmpModal() {
    document.getElementById('eqEmpModal')?.classList.remove('open');
}

export function eqSaveEmployee() {
    const nome = document.getElementById('eq-ef-nome')?.value.trim();
    if (!nome) { document.getElementById('eq-ef-nome')?.focus(); return; }
    const data = {
        nome,
        cargo:    document.getElementById('eq-ef-cargo')?.value.trim(),
        dept:     document.getElementById('eq-ef-dept')?.value,
        salario:  parseFloat(document.getElementById('eq-ef-salario')?.value) || 0,
        contrato: document.getElementById('eq-ef-contrato')?.value,
        admissao: document.getElementById('eq-ef-admissao')?.value,
        status:   document.getElementById('eq-ef-status')?.value,
        tel:      document.getElementById('eq-ef-tel')?.value.trim(),
        obs:      document.getElementById('eq-ef-obs')?.value.trim(),
    };
    if (eqEditingId) {
        const idx = employees.findIndex(e => e.id === eqEditingId);
        employees[idx] = { ...employees[idx], ...data };
    } else {
        employees.unshift({ id: eqNextId++, ...data });
    }
    eqCloseEmpModal();
    eqRenderEmployees();
    eqUpdateKPIs();
    mostrarToast('Funcionário salvo com sucesso!');
}

export function eqDeleteEmp(id) {
    if (!confirm('Remover este funcionário?')) return;
    employees = employees.filter(e => e.id !== id);
    eqRenderEmployees();
    eqUpdateKPIs();
    mostrarToast('Funcionário removido.');
}

// ── Contracheque ──────────────────────────────────────
export function eqOpenPayDetail(id) {
    const e = employees.find(x => x.id === id);
    if (!e) return;
    const calc = eqCalcSalary(e);
    const set  = (sel, v) => { const el = document.getElementById(sel); if (el) el.textContent = v; };
    set('eq-pay-emp-name', e.nome);
    set('eq-pay-emp-role', e.cargo);

    const bd = document.getElementById('eqPayBreakdown');
    if (bd) bd.innerHTML = calc.breakdown.map(r => `
      <div class="eq-pb-row">
        <span class="eq-pb-name ${r.type==='ded'?'ded':r.type==='add'?'add':''}">${r.name}</span>
        <span class="eq-pb-val ${r.val<0?'neg':r.val>0&&r.type!=='neutral'?'pos':''}">${r.val>=0?'+':'-'} ${eqFmtBRL(Math.abs(r.val))}</span>
      </div>`).join('');

    set('eq-pb-liquido',       eqFmtBRL(calc.liquido));
    set('eq-pb-custo-empresa', eqFmtBRL(calc.custoEmpresa));
    document.getElementById('eqPayModal')?.classList.add('open');
}
