// ─────────────────────────────────────────
//  VENTSY — Módulo: Calendário de Disponibilidade
// ─────────────────────────────────────────
import { mostrarToast } from '../js/ui.js';
import { sb } from '../js/api.js';
import { state } from '../js/state.js';

// ── Constantes ───────────────────────────────────────
const MESES  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ── Estado do módulo ─────────────────────────────────
const hoje = new Date();
let mesAtual  = hoje.getMonth();
let anoAtual  = hoje.getFullYear();

// bloqueios: { 'YYYY-MM-DD': 'motivo' }
// Inicia do localStorage; futuramente carregado do Supabase
let bloqueios = JSON.parse(localStorage.getItem('ventsy_bloqueios') || '{}');

let _diaSelecionado   = null; // { dia, chave } — dia aberto no modal de bloqueio
let _chaveParaLiberar = null; // { k, dia }     — dia aberto no modal de liberar
let _acaoPendente     = null; // callback da ação "liberar todos"

// ── Init (chamado pelo router na primeira visita) ────
export function init() {
    renderizarCalendario();
    _setupEventListeners();
    _exposeGlobals();
}

// ── Expor funções para onclick= no HTML ─────────────
function _exposeGlobals() {
    window.calMudarMes            = mudarMes;
    window.calAbrirSeletorMes     = abrirSeletorMes;
    window.calAbrirSeletorAno     = abrirSeletorAno;
    window.calSelecionarMes       = selecionarMes;
    window.calSelecionarAno       = selecionarAno;
    window.calSelecionarChip      = selecionarChip;
    window.calConfirmarBloqueio   = confirmarBloqueio;
    window.calFecharModal         = fecharModal;
    window.calFecharModalLiberarDia   = fecharModalLiberarDia;
    window.calFecharModalLiberarTodos = fecharModalLiberarTodos;
    window.calConfirmarLiberarDia     = confirmarLiberarDia;
    window.calValidarTextoLiberarTodos = validarTextoLiberarTodos;
    window.calExecutarLiberarTodos    = executarLiberarTodos;
    window.calBloquearFimsDeSemana    = bloquearFimsDeSemana;
    window.calLiberarTodoMes          = liberarTodoMes;
    window.calSalvarDisponibilidade   = salvarDisponibilidade;
    window.calDesbloquearDia          = desbloquearDia;
}

// ── Listeners de teclado/backdrop (configura uma vez) ─
function _setupEventListeners() {
    // Fechar pickers ao clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#cal-mes-controle')) _fecharTodosPickers();
    });

    // ESC fecha todos os modais do calendário
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            fecharModal();
            fecharModalLiberarDia();
            fecharModalLiberarTodos();
        }
    });

    // Backdrop dos modais
    document.getElementById('cal-modal-bloqueio')?.addEventListener('click', e => {
        if (e.target === document.getElementById('cal-modal-bloqueio')) fecharModal();
    });
    document.getElementById('cal-modal-liberar-dia')?.addEventListener('click', e => {
        if (e.target === document.getElementById('cal-modal-liberar-dia')) fecharModalLiberarDia();
    });
    document.getElementById('cal-modal-liberar-todos')?.addEventListener('click', e => {
        if (e.target === document.getElementById('cal-modal-liberar-todos')) fecharModalLiberarTodos();
    });
}

// ── Chave de data ─────────────────────────────────────
function chave(ano, mes, dia) {
    return `${ano}-${String(mes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
}

// ── Renderizar calendário ─────────────────────────────
function renderizarCalendario() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cal-titulo-mes', MESES[mesAtual]);
    set('cal-titulo-ano', anoAtual);

    // Cabeçalho dias da semana
    SEMANA.forEach(d => {
        const el = document.createElement('div');
        el.className = 'cal-dia-semana';
        el.textContent = d;
        grid.appendChild(el);
    });

    const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
    const totalDias   = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const hojeData    = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

    // Células vazias antes do dia 1
    for (let i = 0; i < primeiroDia; i++) {
        const el = document.createElement('div');
        el.className = 'cal-dia cal-vazio';
        grid.appendChild(el);
    }

    // Dias do mês
    for (let d = 1; d <= totalDias; d++) {
        const k       = chave(anoAtual, mesAtual, d);
        const ehHoje  = (d === hoje.getDate() && mesAtual === hoje.getMonth() && anoAtual === hoje.getFullYear());
        const passado = new Date(anoAtual, mesAtual, d) < hojeData;
        const bloq    = bloqueios[k];

        const el = document.createElement('div');
        el.className = 'cal-dia';
        if (ehHoje)           el.classList.add('cal-hoje');
        if (passado && !ehHoje) el.classList.add('cal-passado');
        if (bloq)             el.classList.add('cal-bloqueado');

        el.innerHTML = `<span>${d}</span>${bloq ? `<span class="cal-dia-motivo">${bloq}</span>` : ''}`;

        if (!passado) {
            el.addEventListener('click', () => clicarDia(d, bloq));
        }
        grid.appendChild(el);
    }

    _atualizarPainel();
}

// ── Clique no dia ─────────────────────────────────────
function clicarDia(dia, motivo) {
    const k = chave(anoAtual, mesAtual, dia);
    if (motivo) {
        _abrirModalLiberar(k, dia, motivo);
        return;
    }
    _diaSelecionado = { dia, chave: k };
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cal-modal-titulo', `🔒 Bloquear dia ${dia}`);
    set('cal-modal-data', `${String(dia).padStart(2,'0')} de ${MESES[mesAtual]} de ${anoAtual}`);
    const inp = document.getElementById('cal-input-motivo');
    if (inp) inp.value = '';
    document.querySelectorAll('.cal-chip').forEach(c => c.classList.remove('selecionado'));
    document.getElementById('cal-modal-bloqueio')?.classList.add('aberto');
}

// ── Chips de motivo ───────────────────────────────────
export function selecionarChip(el) {
    document.querySelectorAll('.cal-chip').forEach(c => c.classList.remove('selecionado'));
    el.classList.add('selecionado');
    const inp = document.getElementById('cal-input-motivo');
    if (inp) inp.value = el.textContent.trim();
}

// ── Confirmar bloqueio ────────────────────────────────
export function confirmarBloqueio() {
    if (!_diaSelecionado) return;
    const motivo = document.getElementById('cal-input-motivo')?.value.trim() || 'Bloqueado';
    bloqueios[_diaSelecionado.chave] = motivo;
    _salvarLocal();
    fecharModal();
    renderizarCalendario();
    mostrarToast(`🔒 Dia ${_diaSelecionado.dia} bloqueado: ${motivo}`);
    _diaSelecionado = null;
}

// ── Fechar modal de bloqueio ──────────────────────────
export function fecharModal() {
    document.getElementById('cal-modal-bloqueio')?.classList.remove('aberto');
}

// ── Modal liberar dia (confirmação simples) ───────────
function _abrirModalLiberar(k, dia, motivo) {
    _chaveParaLiberar = { k, dia };
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cal-liberar-dia-num',    dia);
    set('cal-liberar-dia-mes',    `${MESES[mesAtual]} ${anoAtual}`);
    set('cal-liberar-dia-motivo', motivo);
    document.getElementById('cal-modal-liberar-dia')?.classList.add('aberto');
}

export function confirmarLiberarDia() {
    if (!_chaveParaLiberar) return;
    const { k, dia } = _chaveParaLiberar;
    delete bloqueios[k];
    _salvarLocal();
    renderizarCalendario();
    mostrarToast(`✅ Dia ${dia} liberado!`);
    fecharModalLiberarDia();
    _chaveParaLiberar = null;
}

export function fecharModalLiberarDia() {
    document.getElementById('cal-modal-liberar-dia')?.classList.remove('aberto');
}

// ── Modal liberar todos (exige digitar LIBERAR) ───────
export function fecharModalLiberarTodos() {
    document.getElementById('cal-modal-liberar-todos')?.classList.remove('aberto');
    _acaoPendente = null;
}

export function validarTextoLiberarTodos() {
    const val = document.getElementById('cal-input-confirmar')?.value.trim().toUpperCase();
    const btn = document.getElementById('cal-btn-confirmar-liberar');
    const ok  = val === 'LIBERAR';
    if (btn) {
        btn.disabled       = !ok;
        btn.style.opacity  = ok ? '1' : '0.4';
        btn.style.cursor   = ok ? 'pointer' : 'not-allowed';
    }
}

export function executarLiberarTodos() {
    if (_acaoPendente) _acaoPendente();
    fecharModalLiberarTodos();
}

// ── Ações rápidas ─────────────────────────────────────
export function bloquearFimsDeSemana() {
    const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= totalDias; d++) {
        const diaSem = new Date(anoAtual, mesAtual, d).getDay();
        if (diaSem === 0 || diaSem === 6) {
            const k = chave(anoAtual, mesAtual, d);
            if (!bloqueios[k]) { bloqueios[k] = 'Fim de semana'; count++; }
        }
    }
    _salvarLocal();
    renderizarCalendario();
    mostrarToast(`🗓️ ${count} fins de semana bloqueados!`);
}

export function liberarTodoMes() {
    const bloqDoMes = Object.keys(bloqueios).filter(k =>
        k.startsWith(`${anoAtual}-${String(mesAtual + 1).padStart(2,'0')}`)
    );
    if (bloqDoMes.length === 0) {
        mostrarToast('ℹ️ Nenhum dia bloqueado neste mês.');
        return;
    }
    _acaoPendente = () => {
        bloqDoMes.forEach(k => delete bloqueios[k]);
        _salvarLocal();
        renderizarCalendario();
        mostrarToast(`✅ ${bloqDoMes.length} dias liberados!`);
    };
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cal-modal-liberar-titulo',    `⚠️ Liberar todos os dias de ${MESES[mesAtual]}`);
    set('cal-modal-liberar-subtitulo', `Isso vai remover todos os ${bloqDoMes.length} bloqueio(s) deste mês de uma vez. Esta ação não pode ser desfeita.`);
    const inp = document.getElementById('cal-input-confirmar');
    if (inp) inp.value = '';
    const btn = document.getElementById('cal-btn-confirmar-liberar');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
    document.getElementById('cal-modal-liberar-todos')?.classList.add('aberto');
    setTimeout(() => document.getElementById('cal-input-confirmar')?.focus(), 100);
}

export function desbloquearDia(k, dia) {
    _abrirModalLiberar(k, dia, bloqueios[k]);
}

async function salvarDisponibilidade() {
    const propId = state.propId;

    // Monta array de bloqueios para salvar
    const registros = Object.entries(bloqueios).map(([data, motivo]) => ({
        prop_id: propId,
        data,
        motivo
    }));

    // Apaga os do mês atual e regrava (mais simples que fazer diff)
    await sb.from('disponibilidade')
        .delete()
        .eq('prop_id', propId)
        .like('data', `${anoAtual}-${String(mesAtual + 1).padStart(2,'0')}%`);

    if (registros.length > 0) {
        await sb.from('disponibilidade').insert(registros);
    }

    mostrarToast('💾 Disponibilidade salva com sucesso!');
}

// ── Navegar meses ─────────────────────────────────────
export function mudarMes(delta) {
    mesAtual += delta;
    if (mesAtual > 11) { mesAtual = 0;  anoAtual++; }
    if (mesAtual < 0)  { mesAtual = 11; anoAtual--; }
    renderizarCalendario();
}

// ── Seletor de mês ────────────────────────────────────
export function abrirSeletorMes() {
    const picker = document.getElementById('cal-picker-mes');
    const grid   = document.getElementById('cal-meses-grid');
    const jaAberto = picker?.classList.contains('aberto');
    _fecharTodosPickers();
    if (jaAberto || !picker || !grid) return;

    grid.innerHTML = MESES.map((nome, i) => `
        <div class="cal-mes-opcao${i === mesAtual ? ' atual' : ''}" onclick="calSelecionarMes(${i})">
            ${nome.substring(0, 3)}
        </div>`).join('');
    picker.classList.add('aberto');
}

export function selecionarMes(m) {
    mesAtual = m;
    _fecharTodosPickers();
    renderizarCalendario();
}

// ── Seletor de ano ────────────────────────────────────
export function abrirSeletorAno() {
    const picker = document.getElementById('cal-picker-ano');
    const lista  = document.getElementById('cal-anos-lista');
    const jaAberto = picker?.classList.contains('aberto');
    _fecharTodosPickers();
    if (jaAberto || !picker || !lista) return;

    const anoInicio = 2026;
    const anoFim    = new Date().getFullYear() + 10;
    lista.innerHTML = '';
    for (let a = anoInicio; a <= anoFim; a++) {
        const el = document.createElement('div');
        el.className = 'cal-ano-opcao' + (a === anoAtual ? ' atual' : '');
        el.textContent = a;
        el.onclick = () => selecionarAno(a);
        lista.appendChild(el);
    }
    picker.classList.add('aberto');
    const atual = lista.querySelector('.atual');
    if (atual) setTimeout(() => atual.scrollIntoView({ block: 'center' }), 50);
}

export function selecionarAno(a) {
    anoAtual = a;
    _fecharTodosPickers();
    renderizarCalendario();
}

function _fecharTodosPickers() {
    document.getElementById('cal-picker-mes')?.classList.remove('aberto');
    document.getElementById('cal-picker-ano')?.classList.remove('aberto');
}

// ── Painel lateral ────────────────────────────────────
function _atualizarPainel() {
    const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const prefixo   = `${anoAtual}-${String(mesAtual + 1).padStart(2,'0')}`;
    const bloqDoMes = Object.keys(bloqueios).filter(k => k.startsWith(prefixo));
    const numBloq   = bloqDoMes.length;
    const numLivres = totalDias - numBloq;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cal-res-total',      totalDias);
    set('cal-res-livres',     numLivres);
    set('cal-res-bloqueados', numBloq);

    const lista = document.getElementById('cal-lista-bloqueios');
    if (!lista) return;
    if (bloqDoMes.length === 0) {
        lista.innerHTML = '<div class="cal-sem-bloqueios">Nenhum dia bloqueado</div>';
        return;
    }
    lista.innerHTML = bloqDoMes.sort().map(k => {
        const diaNum = parseInt(k.split('-')[2]);
        return `
          <div class="cal-item-bloqueio">
            <div>
              <div class="cal-data-blq">Dia ${diaNum}</div>
              <div class="cal-motivo-blq">${bloqueios[k]}</div>
            </div>
            <button class="cal-btn-desbloq" title="Liberar" onclick="calDesbloquearDia('${k}', ${diaNum})">✕</button>
          </div>`;
    }).join('');
}

// ── Persistência local ────────────────────────────────
function _salvarLocal() {
    localStorage.setItem('ventsy_bloqueios', JSON.stringify(bloqueios));
}
