// ─────────────────────────────────────────
//  VENTSY — Módulo: Assinaturas e Planos
// ─────────────────────────────────────────
import { sb } from '../js/api.js';
import { state } from '../js/state.js';
import { mostrarToast } from '../js/ui.js';

// ── Configuração ──────────────────────────────────────
const MP_PUBLIC_KEY = 'TEST-979ac9c0-4f5b-47de-a63c-83f587865274'; // ← substitua
const EDGE_URL      = `https://hxvlfalgrduitevbhqvq.supabase.co/functions/v1`;

// ── Dados dos planos ──────────────────────────────────
const PLANOS = [
    {
        id: 'basico', nome: 'Básico', icone: '🏷️', preco: 0,
        precoFormatado: 'Grátis', destaque: false,
        desc: 'Para quem está começando a divulgar seu espaço.',
        beneficios: [
            { texto: 'Cadastro de 1 propriedade',   ok: true  },
            { texto: 'Até 10 fotos na galeria',       ok: true  },
            { texto: 'Botão de WhatsApp direto',      ok: true  },
            { texto: 'Relatório de desempenho',       ok: false },
            { texto: 'Selo de verificação',           ok: false },
            { texto: 'Destaque na busca',             ok: false },
        ],
    },
    {
        id: 'pro', nome: 'Pro', icone: '⭐', preco: 89,
        precoFormatado: 'R$ 89', destaque: true,
        desc: 'Ideal para chácaras e salões profissionais.',
        beneficios: [
            { texto: 'Tudo do plano Básico',          ok: true  },
            { texto: 'Fotos e vídeos ilimitados',     ok: true  },
            { texto: 'Relatórios detalhados',         ok: true  },
            { texto: 'Calendário de Disponibilidade', ok: true  },
            { texto: 'Suporte prioritário',           ok: true  },
            { texto: 'Destaque na busca',             ok: false },
        ],
    },
    {
        id: 'ultra', nome: 'Ultra', icone: '🚀', preco: 149,
        precoFormatado: 'R$ 149', destaque: false,
        desc: 'O máximo de visibilidade para seu negócio.',
        beneficios: [
            { texto: 'Tudo do plano Pro',              ok: true },
            { texto: 'Aparecer no topo das buscas',    ok: true },
            { texto: 'Selo de Verificação Gold',       ok: true },
            { texto: 'Destaque na Home do site',       ok: true },
            { texto: 'Gerador de Contratos PDF',       ok: true },
            { texto: 'Gerente de conta dedicado',      ok: true },
        ],
    },
];

// ── Estado do módulo ─────────────────────────────────
let ESTADO = {
    planoAtivo:        'basico',
    validadeAte:       '—',
    downgradeAgendado: null,
    status:            null,
};

let _userId              = null;
let _planoCheckout       = null;
let _planoDowngrade      = null;
let _mesesSelecionados   = 1;
let _cupomAtivo          = null;
let _mp                  = null;
let _cardForm            = null;
let _pollingInterval     = null;

// ── Init ──────────────────────────────────────────────
export async function init() {
    _userId = state.user?.id;

    // Inicializa SDK Mercado Pago (pode já estar carregado pelo CDN)
    if (window.MercadoPago && !_mp) {
        try { _mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' }); } catch(e) { console.warn('MP SDK:', e); }
    }

    try { await _carregarAssinatura(); }      catch(e) { console.warn('carregarAssinatura:', e); }
    try { await _sincronizarComAdmin(); }     catch(e) { console.warn('sincronizarComAdmin:', e); }

    _renderizarBanner();
    _renderizarCards();
    _exposeGlobals();
}

function _exposeGlobals() {
    window.planosAbrirCheckout       = abrirCheckout;
    window.planosFecharCheckout      = fecharCheckout;
    window.planosSelecionarDuracao   = selecionarDuracao;
    window.planosAplicarCupom        = aplicarCupom;
    window.planosTrocarMetodo        = trocarMetodo;
    window.planosToggleNFe           = toggleNFe;
    window.planosValidarBtnFinalizar = validarBtnFinalizar;
    window.planosFinalizarCompra     = finalizarCompra;
    window.planosAbrirDowngrade      = abrirDowngrade;
    window.planosValidarDowngrade    = validarConfirmaDowngrade;
    window.planosExecutarDowngrade   = executarDowngrade;
    window.planosFecharModal         = fecharModal;
    window.planosFecharModalPagamento = fecharModalPagamento;
    window.planosCopiarPix           = copiarPix;
    window.planosMascaraCartao       = mascaraCartao;
    window.planosMascaraValidade     = mascaraValidade;
    window.planosMascaraCPFCNPJ      = mascaraCPFCNPJ;
    window.planosMascaraCEP          = mascaraCEP;
}

// ── Helpers de data ───────────────────────────────────
function _fmtData(iso) {
    if (!iso) return '—';
    const [y,m,d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
}
function _hoje()         { return new Date().toISOString().split('T')[0]; }
function _addDias(iso, n){ const d = new Date(iso); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; }
function _fmtBRL(v)      { return 'R$ ' + v.toFixed(2).replace('.', ','); }

// ── Carregar assinatura ───────────────────────────────
async function _carregarAssinatura() {
    const { data, error } = await sb.from('assinaturas').select('*').eq('usuario_id', _userId).single();
    if (error || !data) { await _criarTrialUltra(); return; }
    ESTADO.planoAtivo        = data.plano_ativo;
    ESTADO.validadeAte       = _fmtData(data.fim_periodo);
    ESTADO.downgradeAgendado = data.downgrade_para || null;
    ESTADO.status            = data.status;
}

async function _criarTrialUltra() {
    const inicio = _hoje(), fim = _addDias(inicio, 30);
    const { error } = await sb.from('assinaturas').insert({
        usuario_id: _userId, plano_ativo: 'ultra', status: 'trial',
        valor_pago: 0, inicio_periodo: inicio, fim_periodo: fim,
    });
    if (!error) { ESTADO.planoAtivo = 'ultra'; ESTADO.validadeAte = _fmtData(fim); ESTADO.status = 'trial'; }
}

// ── Sincronizar com admin ─────────────────────────────
async function _sincronizarComAdmin() {
    const { data, error } = await sb.from('planos_config').select('*');
    if (error || !data) return;
    const cfg = {};
    data.forEach(row => { cfg[row.id] = row; });
    for (let i = PLANOS.length - 1; i >= 0; i--) {
        const plano = PLANOS[i];
        const admin = cfg[plano.id];
        if (!admin) continue;
        if (admin.status === 'oculto') { PLANOS.splice(i, 1); continue; }
        plano.preco = admin.preco ?? plano.preco;
        plano.precoFormatado = plano.preco === 0 ? 'Grátis' : 'R$ ' + plano.preco;
        if (Array.isArray(admin.items) && admin.items.length) {
            plano.beneficios = admin.items.map(texto => ({ texto, ok: true }));
        }
    }
}

// ── Recarregar após pagamento ─────────────────────────
async function _recarregarAssinatura() {
    await _carregarAssinatura();
    _renderizarBanner();
    _renderizarCards();
}

// ── Banner do plano ativo ─────────────────────────────
function _renderizarBanner() {
    const plano = PLANOS.find(p => p.id === ESTADO.planoAtivo) || PLANOS[0];
    if (!plano) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('planos-banner-icone',    plano.icone);
    set('planos-banner-titulo',   'Plano ' + plano.nome + ' — Ativo');
    set('planos-banner-validade', 'Válido até ' + ESTADO.validadeAte);
    set('planos-banner-desc',     plano.preco === 0 ? plano.nome : plano.nome + ' — ' + plano.precoFormatado + '/mês');
    const chipSidebar = document.getElementById('sidebar-plano-chip');
    if (chipSidebar) chipSidebar.textContent = plano.icone + ' ' + plano.nome;
    const valSidebar = document.getElementById('sidebar-validade');
    if (valSidebar && ESTADO.validadeAte !== '—') valSidebar.textContent = `Válido até ${ESTADO.validadeAte}`;
    const badgeDown = document.getElementById('planos-badge-downgrade');
    if (badgeDown && ESTADO.downgradeAgendado) {
        const downPlan = PLANOS.find(p => p.id === ESTADO.downgradeAgendado);
        badgeDown.style.display = 'inline-flex';
        badgeDown.textContent   = `⏳ Mudará para ${downPlan?.nome} em ${ESTADO.validadeAte}`;
    }
}

// ── Cards de planos ───────────────────────────────────
function _renderizarCards() {
    const container = document.getElementById('planos-container');
    if (!container) return;
    container.innerHTML = '';
    const ordemAtivo = PLANOS.findIndex(p => p.id === ESTADO.planoAtivo);

    PLANOS.forEach((plano, idx) => {
        const eAtivo       = plano.id === ESTADO.planoAtivo;
        const eUpgrade     = idx > ordemAtivo;
        const eDowngrade   = idx < ordemAtivo;
        const eDownPend    = ESTADO.downgradeAgendado === plano.id;
        const eSelecionado = _planoCheckout === plano.id;

        let classes = 'card-plano';
        if (plano.destaque)  classes += ' destaque';
        if (eAtivo)          classes += ' plano-ativo';
        if (eSelecionado)    classes += ' selecionado';

        let badgeHTML = '';
        if (eSelecionado)      badgeHTML = `<div class="card-badge-topo badge-selecionado-card">✔ SELECIONADO</div>`;
        else if (eAtivo)       badgeHTML = `<div class="card-badge-topo badge-ativo-card">✔ SEU PLANO ATUAL</div>`;
        else if (eDownPend)    badgeHTML = `<div class="card-badge-topo badge-pendente-card">⏳ DOWNGRADE AGENDADO</div>`;
        else if (plano.destaque) badgeHTML = `<div class="card-badge-topo badge-popular">MAIS POPULAR</div>`;

        const beneficiosHTML = plano.beneficios.map(b =>
            `<li class="${b.ok ? '' : 'bloqueado'}"><span class="check">${b.ok ? '✔' : '✗'}</span> ${b.texto}</li>`
        ).join('');

        let btnHTML = '', infoHTML = '';
        if (eAtivo && !eSelecionado) {
            btnHTML = `<button class="btn-card btn-atual" onclick="planosAbrirCheckout('${plano.id}')">🔄 Renovar plano</button>`;
        } else if (eSelecionado) {
            btnHTML = `<button class="btn-card btn-selecionado" onclick="planosFecharCheckout()">✔ Selecionado — ver checkout ↓</button>`;
        } else if (eUpgrade) {
            const atual     = PLANOS.find(p => p.id === ESTADO.planoAtivo);
            const diferenca = plano.preco - atual.preco;
            const label     = atual.preco > 0 ? `⬆️ Upgrade — R$ ${diferenca}/mês` : `⬆️ Assinar ${plano.nome}`;
            btnHTML  = `<button class="btn-card btn-selecionar" onclick="planosAbrirCheckout('${plano.id}')">${label}</button>`;
            if (atual.preco > 0) infoHTML = `<div class="info-upgrade">💚 Paga apenas a diferença de R$ ${diferenca}/mês</div>`;
        } else if (eDowngrade) {
            if (eDownPend) {
                btnHTML  = `<button class="btn-card btn-downgrade" disabled>⏳ Downgrade agendado</button>`;
                infoHTML = `<div class="info-downgrade-pendente">Entrará em vigor após ${ESTADO.validadeAte}</div>`;
            } else {
                btnHTML  = `<button class="btn-card btn-downgrade" onclick="planosAbrirDowngrade('${plano.id}')">⬇️ Fazer downgrade</button>`;
            }
        }

        const precoHTML = plano.preco === 0
            ? `<div class="preco">Grátis</div>`
            : `<div class="preco">${plano.precoFormatado}<span>/mês</span></div>`;

        container.innerHTML += `
            <div class="${classes}" id="planos-card-${plano.id}">
                ${badgeHTML}
                <div class="plano-header">
                    <h3>${plano.icone} ${plano.nome}</h3>
                    ${precoHTML}
                    <div class="plano-desc">${plano.desc}</div>
                </div>
                <ul class="lista-beneficios">${beneficiosHTML}</ul>
                ${btnHTML}${infoHTML}
            </div>`;
    });
}

// ── Checkout ──────────────────────────────────────────
export function abrirCheckout(planoId) {
    _planoCheckout    = planoId;
    _mesesSelecionados = 1;
    _cupomAtivo       = null;

    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setC = (id, c) => { const el = document.getElementById(id); if (el) el.className = c; };
    setV('planos-input-cupom', '');
    setC('planos-input-cupom', 'input-cupom');
    const fb = document.getElementById('planos-cupom-feedback'); if (fb) fb.style.display = 'none';
    const termos = document.getElementById('planos-check-termos'); if (termos) termos.checked = false;
    const btnF = document.getElementById('planos-btn-finalizar'); if (btnF) btnF.disabled = true;

    document.querySelectorAll('.planos-duracao-btn').forEach(b => b.classList.remove('ativo'));
    document.querySelector('.planos-duracao-btn[data-meses="1"]')?.classList.add('ativo');

    _atualizarResumo();
    const el = document.getElementById('planos-checkout-inline');
    if (el) { el.style.display = 'block'; }
    _renderizarCards();
    setTimeout(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

export function fecharCheckout() {
    _planoCheckout = null;
    _pararPolling();
    if (_cardForm) { try { _cardForm.unmount(); } catch(e) {} _cardForm = null; }
    const el = document.getElementById('planos-checkout-inline');
    if (el) el.style.display = 'none';
    _renderizarCards();
}

// ── Duração ───────────────────────────────────────────
export function selecionarDuracao(meses) {
    _mesesSelecionados = meses;
    document.querySelectorAll('.planos-duracao-btn').forEach(b => {
        b.classList.toggle('ativo', parseInt(b.dataset.meses) === meses);
    });
    _atualizarResumo();
}

// ── Calcular total ────────────────────────────────────
function _calcularTotal() {
    if (!_planoCheckout) return 0;
    const plano = PLANOS.find(p => p.id === _planoCheckout);
    const atual = PLANOS.find(p => p.id === ESTADO.planoAtivo);
    const eUpgrade = plano.id !== ESTADO.planoAtivo && plano.preco > atual.preco && atual.preco > 0;
    const eAnual   = _mesesSelecionados === 12;
    const subtotal = plano.preco * _mesesSelecionados;
    const dsAnual  = eAnual ? subtotal * 0.2 : 0;
    const credito  = eUpgrade ? atual.preco : 0;
    let dsCupom = 0;
    if (_cupomAtivo) {
        const base = subtotal - dsAnual - credito;
        dsCupom = _cupomAtivo.tipo === 'percent' ? base * (_cupomAtivo.valor / 100) : Math.min(_cupomAtivo.valor, base);
    }
    return Math.max(0, subtotal - dsAnual - credito - dsCupom);
}

// ── Resumo do checkout ────────────────────────────────
function _atualizarResumo() {
    if (!_planoCheckout) return;
    const plano = PLANOS.find(p => p.id === _planoCheckout);
    const atual = PLANOS.find(p => p.id === ESTADO.planoAtivo);
    const eAnual   = _mesesSelecionados === 12;
    const subtotal = plano.preco * _mesesSelecionados;
    const dsAnual  = eAnual ? subtotal * 0.2 : 0;
    const eUpgrade = plano.id !== ESTADO.planoAtivo && plano.preco > atual.preco && atual.preco > 0;
    const credito  = eUpgrade ? atual.preco : 0;
    let dsCupom = 0;
    if (_cupomAtivo) {
        const base = subtotal - dsAnual - credito;
        dsCupom = _cupomAtivo.tipo === 'percent' ? base * (_cupomAtivo.valor / 100) : Math.min(_cupomAtivo.valor, base);
    }
    const total = Math.max(0, subtotal - dsAnual - credito - dsCupom);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const eRenovacao = plano.id === ESTADO.planoAtivo;
    set('planos-checkout-titulo',   eRenovacao ? '🔄 Renovar Plano ' + plano.nome : '🛒 Assinar Plano ' + plano.nome);
    set('planos-resumo-nome',       plano.icone + ' Plano ' + plano.nome);
    set('planos-resumo-preco',      plano.precoFormatado + (plano.preco > 0 ? '/mês' : ''));
    set('planos-resumo-desc',       _mesesSelecionados === 1 ? '1 mês de acesso' : _mesesSelecionados === 12 ? '12 meses (plano anual)' : _mesesSelecionados + ' meses de acesso');
    set('planos-val-subtotal',      _fmtBRL(subtotal));
    set('planos-resumo-total',      _fmtBRL(total));

    const show = (id, v) => { const el = document.getElementById(id); if (el) el.style.display = v ? 'flex' : 'none'; };
    show('planos-linha-desconto-anual', eAnual);
    if (eAnual) set('planos-val-desconto-anual', '− ' + _fmtBRL(dsAnual));
    show('planos-linha-credito', credito > 0);
    if (credito > 0) set('planos-val-credito', '− ' + _fmtBRL(credito));
    show('planos-linha-desconto-cupom', dsCupom > 0);
    if (dsCupom > 0) {
        set('planos-val-desconto-cupom', '− ' + _fmtBRL(dsCupom));
        set('planos-label-desconto-cupom', `🎟 Cupom ${_cupomAtivo.codigo} (${_cupomAtivo.tipo === 'percent' ? _cupomAtivo.valor + '%' : 'R$ ' + _cupomAtivo.valor} off)`);
    }

    // Parcelas do cartão
    const selParcelas = document.getElementById('planos-cartao-parcelas');
    if (selParcelas) {
        selParcelas.innerHTML = '';
        [1, 2, 3, 6].filter(n => n <= _mesesSelecionados || n === 1).forEach(n => {
            const op = document.createElement('option');
            op.value = n;
            op.textContent = n === 1 ? `1x de ${_fmtBRL(total)} sem juros` : `${n}x de ${_fmtBRL(total / n)} sem juros`;
            selParcelas.appendChild(op);
        });
    }
}

// ── Cupom ─────────────────────────────────────────────
export async function aplicarCupom() {
    const codigo  = document.getElementById('planos-input-cupom')?.value.trim().toUpperCase();
    const inputEl = document.getElementById('planos-input-cupom');
    const btnEl   = document.getElementById('planos-btn-aplicar-cupom');
    if (!codigo) return;
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '...'; }
    try {
        const { data, error } = await sb.from('cupons').select('*').eq('codigo', codigo).single();
        if (error || !data) { _feedbackCupom('❌ Cupom não encontrado.', 'erro', inputEl); _cupomAtivo = null; return; }
        if (data.validade && new Date(data.validade) < new Date()) { _feedbackCupom('❌ Cupom expirado.', 'erro', inputEl); _cupomAtivo = null; return; }
        if (data.ativo === false) { _feedbackCupom('❌ Cupom inativo.', 'erro', inputEl); _cupomAtivo = null; return; }
        if (data.limite && data.usos_atual >= data.limite) { _feedbackCupom('❌ Limite de usos atingido.', 'erro', inputEl); _cupomAtivo = null; return; }
        if (data.plano && data.plano !== 'todos' && data.plano !== _planoCheckout) { _feedbackCupom(`❌ Cupom válido apenas para o plano ${data.plano}.`, 'erro', inputEl); _cupomAtivo = null; return; }
        _cupomAtivo = { codigo: data.codigo, tipo: data.tipo, valor: data.valor, id: data.id };
        _feedbackCupom(`✅ Cupom aplicado: ${data.tipo === 'percent' ? data.valor + '% off' : 'R$ ' + data.valor + ' off'}`, 'ok', inputEl);
        if (inputEl) inputEl.className = 'input-cupom valido';
    } catch(e) {
        _feedbackCupom('❌ Erro ao verificar cupom.', 'erro', inputEl);
        _cupomAtivo = null;
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Aplicar'; }
        _atualizarResumo();
    }
}

function _feedbackCupom(msg, tipo, inputEl) {
    const fb = document.getElementById('planos-cupom-feedback');
    if (fb) { fb.textContent = msg; fb.className = 'cupom-feedback ' + tipo; fb.style.display = 'block'; }
    if (inputEl) inputEl.className = 'input-cupom ' + (tipo === 'ok' ? 'valido' : 'invalido');
}

// ── Método de pagamento ───────────────────────────────
export function trocarMetodo(metodo) {
    ['pix','cartao','boleto'].forEach(m => {
        const el = document.getElementById('planos-area-' + m);
        if (el) el.style.display = 'none';
    });
    const el = document.getElementById('planos-area-' + metodo);
    if (el) el.style.display = 'block';
    if (metodo === 'cartao') setTimeout(() => _inicializarCardForm(), 150);
}

// ── NF-e toggle ───────────────────────────────────────
export function toggleNFe() {
    const area = document.getElementById('planos-nfe-area');
    const seta = document.getElementById('planos-nfe-seta');
    const aberto = area?.classList.toggle('aberto');
    if (seta) seta.textContent = aberto ? '▼' : '▶';
}

// ── Validação do botão finalizar ──────────────────────
export function validarBtnFinalizar() {
    const aceitou = document.getElementById('planos-check-termos')?.checked;
    const btn = document.getElementById('planos-btn-finalizar');
    if (btn) btn.disabled = !aceitou;
}

// ── CardForm Mercado Pago ──────────────────────────────
function _inicializarCardForm() {
    if (_cardForm) { try { _cardForm.unmount(); } catch(e) {} _cardForm = null; }
    if (!_mp || !_planoCheckout) return;
    const areaCartao = document.getElementById('planos-area-cartao');
    if (areaCartao) areaCartao.style.display = 'block';
    try {
        _cardForm = _mp.cardForm({
            amount: String(_calcularTotal().toFixed(2)),
            iframe: false,
            form: {
                id:             'planos-form-cartao-mp',
                cardNumber:     { id: 'planos-cartao-numero',   placeholder: 'Número do Cartão' },
                expirationDate: { id: 'planos-cartao-validade',  placeholder: 'MM/AA' },
                securityCode:   { id: 'planos-cartao-cvv',      placeholder: 'CVV' },
                cardholderName: { id: 'planos-cartao-nome',     placeholder: 'Nome igual ao cartão' },
                installments:   { id: 'planos-cartao-parcelas'  },
            },
            callbacks: {
                onFormMounted: err => { if (err) console.warn('MP cardForm:', err); },
                onError: errors => { console.warn('MP errors:', errors); },
            },
        });
    } catch(e) { console.warn('cardForm init error:', e); _cardForm = null; }
}

// ── Polling (Pix/boleto) ──────────────────────────────
function _iniciarPolling(pagamentoId) {
    _pollingInterval = setInterval(async () => {
        try {
            const { data } = await sb.from('pagamentos').select('status,mp_status_detail').eq('id', pagamentoId).single();
            if (!data) return;
            if (data.status === 'approved') { _pararPolling(); await _recarregarAssinatura(); _mostrarModalSucesso(); }
            else if (data.status === 'rejected' || data.status === 'cancelled') { _pararPolling(); _mostrarModalRejeitado(data.mp_status_detail); }
        } catch(e) {}
    }, 5000);
}

function _pararPolling() {
    if (_pollingInterval) { clearInterval(_pollingInterval); _pollingInterval = null; }
}

// ── Finalizar compra ──────────────────────────────────
export async function finalizarCompra() {
    if (!_planoCheckout) return;
    if (!document.getElementById('planos-check-termos')?.checked) {
        mostrarToast('⚠️ Aceite os termos de uso para continuar.');
        return;
    }
    const btnF = document.getElementById('planos-btn-finalizar');
    if (btnF) { btnF.disabled = true; btnF.innerHTML = '<span class="spinner" style="display:inline-block;margin-right:8px;"></span>Processando...'; }

    const metodo    = document.querySelector('input[name="planos-pagamento"]:checked')?.value || 'pix';
    const planoObj  = PLANOS.find(p => p.id === _planoCheckout);
    const valorTotal = _calcularTotal();

    const { data: { session } } = await sb.auth.getSession();
    const { data: perfil } = await sb.from('usuarios').select('nome').eq('id', _userId).single();

    const g = id => document.getElementById(id)?.value?.trim() || '';
    const nfeData = {
        cpfcnpj: g('planos-nfe-cpfcnpj') || null, nome: g('planos-nfe-nome') || null,
        email: g('planos-nfe-email') || null, endereco: g('planos-nfe-endereco') || null,
        cep: g('planos-nfe-cep') || null, cidade: g('planos-nfe-cidade') || null,
        estado: document.getElementById('planos-nfe-estado')?.value || null,
    };

    const payload = {
        metodo,
        plano_id:      _planoCheckout, plano_nome: planoObj.nome,
        meses:         _mesesSelecionados, valor_total: valorTotal,
        cupom_id:      _cupomAtivo?.id || null, cupom_codigo: _cupomAtivo?.codigo || null,
        email:         session.user.email, nome_completo: perfil?.nome || session.user.email,
        cpf_cnpj:      g('planos-boleto-cpf') || g('planos-cartao-cpf') || nfeData.cpfcnpj || '',
        nfe:           Object.values(nfeData).some(v => v) ? nfeData : null,
    };

    if (metodo === 'cartao') {
        if (!_cardForm) { mostrarToast('⚠️ Formulário do cartão não pronto. Tente novamente.'); if (btnF) { btnF.disabled = false; btnF.innerHTML = '✅ Confirmar e Finalizar Pagamento'; } return; }
        try {
            const cardData = _cardForm.getCardFormData();
            if (!cardData.token) { mostrarToast('❌ Erro ao processar cartão. Verifique os dados.'); if (btnF) { btnF.disabled = false; btnF.innerHTML = '✅ Confirmar e Finalizar Pagamento'; } return; }
            payload.card_token        = cardData.token;
            payload.installments      = parseInt(document.getElementById('planos-cartao-parcelas')?.value) || 1;
            payload.payment_method_id = cardData.paymentMethodId;
            payload.issuer_id         = cardData.issuerId;
        } catch(e) { mostrarToast('❌ Erro ao tokenizar cartão.'); if (btnF) { btnF.disabled = false; btnF.innerHTML = '✅ Confirmar e Finalizar Pagamento'; } return; }
    }

    if (metodo === 'boleto' || metodo === 'pix') {
        payload.endereco_rua    = nfeData.endereco?.split(',')[0]?.trim() || 'Não informado';
        payload.endereco_numero = nfeData.endereco?.split(',')[1]?.trim() || 'S/N';
        payload.endereco_bairro = 'Não informado';
        payload.endereco_cep    = nfeData.cep    || '01310100';
        payload.endereco_cidade = nfeData.cidade || 'São Paulo';
        payload.endereco_estado = nfeData.estado || 'SP';
    }

    try {
        const res  = await fetch(`${EDGE_URL}/criar-pagamento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detalhe || data.error || 'Erro no servidor');
        fecharCheckout();
        if (metodo === 'pix')    { _mostrarModalPix(data, planoObj.nome);    _iniciarPolling(data.pagamento_id); }
        if (metodo === 'boleto') { _mostrarModalBoleto(data, planoObj.nome); _iniciarPolling(data.pagamento_id); }
        if (metodo === 'cartao') { data.aprovado ? (await _recarregarAssinatura(), _mostrarModalSucesso()) : _mostrarModalRejeitado(data.detalhe); }
    } catch(err) {
        console.error('Erro ao finalizar compra:', err);
        mostrarToast(`❌ ${err.message || 'Erro ao processar.'}`, 'erro');
    } finally {
        if (btnF) { btnF.disabled = false; btnF.innerHTML = '✅ Confirmar e Finalizar Pagamento'; }
    }
}

// ── Modais de resultado do pagamento ─────────────────
function _mostrarModalPix(data, planoNome) {
    const box = document.getElementById('planos-modal-pagamento-conteudo');
    if (!box) return;
    box.innerHTML = `
        <div class="ico">⚡</div>
        <h3>QR Code Pix gerado!</h3>
        <p>Escaneie o QR Code ou copie o código para pagar.<br>O plano <strong>${planoNome}</strong> será ativado em até 1 minuto.</p>
        <div class="qr-wrapper">
            ${data.qr_code_base64 ? `<img src="data:image/png;base64,${data.qr_code_base64}" alt="QR Code Pix">` : '<p style="color:#888;">Use o código abaixo.</p>'}
        </div>
        <div class="qr-copia-cola" id="planos-pix-codigo">${data.qr_code || '—'}</div>
        <button class="btn-copiar-pix" onclick="planosCopiarPix()">📋 Copiar código Pix</button>
        <div class="polling-status"><div class="spinner"></div><span>Aguardando confirmação...</span></div>
        <button class="btn-fechar-resultado" onclick="planosFecharModalPagamento()">Fechar e aguardar depois</button>`;
    document.getElementById('planos-modal-pagamento')?.classList.add('aberto');
}

function _mostrarModalBoleto(data, planoNome) {
    const venc = data.vencimento ? new Date(data.vencimento).toLocaleDateString('pt-BR') : '3 dias';
    const box  = document.getElementById('planos-modal-pagamento-conteudo');
    if (!box) return;
    box.innerHTML = `
        <div class="ico">📄</div>
        <h3>Boleto gerado!</h3>
        <p>Pague até <strong>${venc}</strong>. O plano <strong>${planoNome}</strong> será ativado em até 3 dias úteis.</p>
        ${data.codigo_barras ? `<div class="boleto-codigo">${data.codigo_barras}</div>` : ''}
        ${data.boleto_url ? `<a class="btn-abrir-boleto" href="${data.boleto_url}" target="_blank">📥 Abrir / Imprimir Boleto</a>` : ''}
        <div class="polling-status"><div class="spinner"></div><span>Aguardando confirmação...</span></div>
        <button class="btn-fechar-resultado" onclick="planosFecharModalPagamento()">Fechar e aguardar depois</button>`;
    document.getElementById('planos-modal-pagamento')?.classList.add('aberto');
}

function _mostrarModalSucesso() {
    _pararPolling();
    const box = document.getElementById('planos-modal-pagamento-conteudo');
    if (!box) return;
    box.innerHTML = `
        <div class="ico">🎉</div>
        <div class="sucesso-box"><h4>Pagamento confirmado!</h4><p>Seu plano foi ativado com sucesso. Aproveite todos os recursos!</p></div>
        <button class="btn-abrir-boleto" onclick="planosFecharModalPagamento()">✅ Ir para o Dashboard</button>`;
    document.getElementById('planos-modal-pagamento')?.classList.add('aberto');
    _renderizarBanner(); _renderizarCards();
}

function _mostrarModalRejeitado(detalhe) {
    _pararPolling();
    const msgs = {
        'cc_rejected_insufficient_amount': 'Saldo insuficiente no cartão.',
        'cc_rejected_bad_filled_card_number': 'Número do cartão incorreto.',
        'cc_rejected_bad_filled_date': 'Data de validade incorreta.',
        'cc_rejected_bad_filled_other': 'Dados do cartão incorretos.',
        'cc_rejected_call_for_authorize': 'Ligue para o banco para autorizar.',
        'cc_rejected_card_disabled': 'Cartão desabilitado. Contate seu banco.',
    };
    const motivo = msgs[detalhe] || 'Pagamento não aprovado. Verifique os dados e tente novamente.';
    const box    = document.getElementById('planos-modal-pagamento-conteudo');
    if (!box) return;
    box.innerHTML = `
        <div class="ico">❌</div>
        <div class="rejeitado-box"><h4>Pagamento não aprovado</h4><p>${motivo}</p></div>
        <button class="btn-abrir-boleto" style="background:#ff385c;" onclick="planosFecharModalPagamento()">Tentar novamente</button>`;
    document.getElementById('planos-modal-pagamento')?.classList.add('aberto');
}

export function fecharModalPagamento() {
    document.getElementById('planos-modal-pagamento')?.classList.remove('aberto');
}

export function copiarPix() {
    const codigo = document.getElementById('planos-pix-codigo')?.textContent;
    if (!codigo) return;
    navigator.clipboard.writeText(codigo)
        .then(() => mostrarToast('📋 Código Pix copiado!'))
        .catch(() => mostrarToast('⚠️ Não foi possível copiar.'));
}

// ── Downgrade ────────────────────────────────────────
export function abrirDowngrade(planoId) {
    _planoDowngrade = planoId;
    const destino = PLANOS.find(p => p.id === planoId);
    const atual   = PLANOS.find(p => p.id === ESTADO.planoAtivo);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('planos-downgrade-nome-destino', destino.nome);
    set('planos-downgrade-nome-atual',   atual.nome);
    set('planos-downgrade-data-fim',     ESTADO.validadeAte);
    const inp = document.getElementById('planos-input-confirma-downgrade');
    if (inp) inp.value = '';
    validarConfirmaDowngrade('');
    document.getElementById('planos-modal-downgrade')?.classList.add('aberto');
}

export function validarConfirmaDowngrade(valor) {
    const btn = document.getElementById('planos-btn-ok-downgrade');
    if (btn) btn.disabled = valor.trim().toUpperCase() !== 'CONFIRMAR';
}

export async function executarDowngrade() {
    if (!_planoDowngrade) return;
    const btn = document.getElementById('planos-btn-ok-downgrade');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }
    const planoDestinoObj = PLANOS.find(p => p.id === _planoDowngrade);
    try {
        const { error } = await sb.from('assinaturas').update({ downgrade_para: _planoDowngrade }).eq('usuario_id', _userId);
        if (error) throw error;
        await sb.from('historico_assinaturas').insert({
            usuario_id: _userId, tipo_evento: 'downgrade',
            plano_anterior: ESTADO.planoAtivo, plano_novo: _planoDowngrade,
            valor_cobrado: 0, observacao: `Downgrade agendado para ${_planoDowngrade}. Efetiva após ${ESTADO.validadeAte}`,
        });
        ESTADO.downgradeAgendado = _planoDowngrade;
        fecharModal('planos-modal-downgrade');
        _renderizarBanner(); _renderizarCards();
        mostrarToast(`⏳ Downgrade para ${planoDestinoObj.nome} agendado. Ativo após ${ESTADO.validadeAte}`);
    } catch(err) {
        console.error('Erro ao agendar downgrade:', err);
        mostrarToast('❌ Erro ao salvar. Tente novamente.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Confirmar downgrade'; }
        _planoDowngrade = null;
    }
}

export function fecharModal(id) {
    document.getElementById(id)?.classList.remove('aberto');
}

// ── Máscaras ─────────────────────────────────────────
export function mascaraCartao(el) {
    let v = el.value.replace(/\D/g, '').substring(0, 16);
    el.value = v.replace(/(.{4})/g, '$1 ').trim();
}
export function mascaraValidade(el) {
    let v = el.value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 3) v = v.substring(0,2) + '/' + v.substring(2);
    el.value = v;
}
export function mascaraCPFCNPJ(el) {
    let v = el.value.replace(/\D/g, '');
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        v = v.substring(0,14).replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    el.value = v;
}
export function mascaraCEP(el) {
    let v = el.value.replace(/\D/g, '').substring(0, 8);
    if (v.length > 5) v = v.substring(0,5) + '-' + v.substring(5);
    el.value = v;
}
