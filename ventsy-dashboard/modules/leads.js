// ─────────────────────────────────────────
//  VENTSY — Módulo: Clientes & Eventos (Leads)
//  Deps CDN (carregar no index.html):
//    jsPDF:  https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
//    SheetJS: https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ─────────────────────────────────────────
import { sb } from '../js/api.js';
import { state } from '../js/state.js';
import { mostrarToast } from '../js/ui.js';

// ── Estado ────────────────────────────────────────────
let _clientes    = [];
let _filtrados   = [];
let _paginaAtual = 1;
let _porPagina   = 10;
let _ordemCampo  = 'nome_evento';
let _ordemAsc    = true;
let _clienteEditandoStatus = null;
let _expandidos  = new Set();
let _usuarioId   = null;

// ── Mapa de status ────────────────────────────────────
const STATUS_MAP = {
    lead:        ['🟡', 'Lead / Novo',      'st-lead'],
    consultada:  ['🔵', 'Data Consultada',  'st-consultada'],
    visita:      ['🟣', 'Visita Agendada',  'st-visita'],
    negociacao:  ['💗', 'Em Negociação',    'st-negociacao'],
    reserva:     ['🟠', 'Reserva Temp.',    'st-reserva'],
    contratado:  ['✅', 'Contratado',       'st-contratado'],
    briefing:    ['📋', 'Briefing',         'st-briefing'],
    pronto:      ['🟢', 'Pronto p/ Exec.',  'st-pronto'],
    montagem:    ['🔨', 'Em Montagem',      'st-montagem'],
    finalizado:  ['🎊', 'Finalizado',       'st-finalizado'],
    pos:         ['⭐', 'Pós-Evento',       'st-pos'],
    perdido:     ['❌', 'Perdido',          'st-perdido'],
    recontactar: ['🔄', 'Recontactar',      'st-recontactar'],
};

function _classeStatus(s) { return (STATUS_MAP[s] || STATUS_MAP['lead'])[2]; }
function _labelStatus(s)  { const m = STATUS_MAP[s] || STATUS_MAP['lead']; return `${m[0]} ${m[1]}`; }
function _hoje()          { return new Date().toISOString().split('T')[0]; }
function _esc(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _fmtData(ini, fim) {
    if (!ini) return '—';
    const fmt = d => { if (!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}/${y}`; };
    return (!fim || fim===ini) ? fmt(ini) : `${fmt(ini)} — ${fmt(fim)}`;
}

// ── Init ──────────────────────────────────────────────
export async function init() {
    _usuarioId = state.user?.id;
    await carregarClientes();
    _setupModais();
    _exposeGlobals();
}

function _exposeGlobals() {
    window.leadsAplicarFiltros    = aplicarFiltros;
    window.leadsOrdenarPor        = ordenarPor;
    window.leadsMudarPorPagina    = mudarPorPagina;
    window.leadsIrParaPagina      = irParaPagina;
    window.leadsToggleExpandir    = toggleExpandir;
    window.leadsAtualizarCampo    = atualizarCampo;
    window.leadsAtualizarFone     = atualizarFone;
    window.leadsAdicionarFone     = adicionarFone;
    window.leadsRemoverFone       = removerFone;
    window.leadsAdicionarParcela  = adicionarParcela;
    window.leadsAtualizarParcela  = atualizarParcela;
    window.leadsRemoverParcela    = removerParcela;
    window.leadsAtualizarChecklist = atualizarChecklist;
    window.leadsValidarDatas      = validarDatas;
    window.leadsRegistrarUpload   = registrarUpload;
    window.leadsSalvarCliente     = salvarCliente;
    window.leadsConfirmarExcluir  = confirmarExcluir;
    window.leadsAbrirModalNovo    = abrirModalNovo;
    window.leadsFecharModalNovo   = fecharModalNovo;
    window.leadsCriarCliente      = criarClienteModal;
    window.leadsAbrirModalStatus  = abrirModalStatus;
    window.leadsFecharModalStatus = fecharModalStatus;
    window.leadsSelecionarStatus  = selecionarStatus;
    window.leadsExportarExcel     = exportarExcel;
    window.leadsExportarPDF       = exportarPDF;
    window.leadsExportarClientePDF = exportarClientePDF;
}

// ── Carregar do Supabase ──────────────────────────────
async function carregarClientes() {
    try {
        const { data, error } = await sb
            .from('clientes_eventos')
            .select('*')
            .eq('usuario_id', _usuarioId)
            .order('criado_em', { ascending: false });
        if (error) throw error;
        _clientes = (data || []).map(_normalizar);
        aplicarFiltros();
    } catch (err) {
        console.error('Erro ao carregar leads:', err);
        mostrarToast('❌ Erro ao carregar dados do servidor.', 'erro');
        _clientes = [];
        aplicarFiltros();
    }
}

function _normalizar(c) {
    return {
        ...c,
        telefones: Array.isArray(c.telefones) ? c.telefones : [],
        parcelas:  Array.isArray(c.parcelas)  ? c.parcelas  : [],
        checklist: (c.checklist && typeof c.checklist === 'object') ? c.checklist : {},
    };
}

function _montarPayload(c) {
    return {
        usuario_id:             _usuarioId,
        nome_evento:            c.nome_evento            || null,
        quem_contratou:         c.quem_contratou         || null,
        documento:              c.documento              || null,
        email:                  c.email                  || null,
        telefones:              c.telefones              || [],
        contato_emergencia:     c.contato_emergencia     || null,
        como_conheceu:          c.como_conheceu          || null,
        tipo_evento:            c.tipo_evento            || null,
        status:                 c.status                 || 'lead',
        data_inicio:            c.data_inicio            || null,
        data_fim:               c.data_fim               || null,
        horario_inicio:         c.horario_inicio         || null,
        horario_fim:            c.horario_fim            || null,
        qtd_adultos:            c.qtd_adultos            ? parseInt(c.qtd_adultos)  : null,
        qtd_criancas:           c.qtd_criancas           ? parseInt(c.qtd_criancas) : null,
        formato_recepcao:       c.formato_recepcao       || null,
        atracoes:               c.atracoes               || null,
        horario_montagem:       c.horario_montagem       || null,
        horario_desmontagem:    c.horario_desmontagem    || null,
        layout_mesas:           c.layout_mesas           || null,
        servicos_casa:          c.servicos_casa          || null,
        fornecedores:           c.fornecedores           || null,
        necessidades_tecnicas:  c.necessidades_tecnicas  || null,
        checkin_materiais:      c.checkin_materiais      || null,
        valor_total:            c.valor_total            || null,
        forma_pagamento:        c.forma_pagamento        || null,
        parcelas:               c.parcelas               || [],
        taxas_extras:           c.taxas_extras           || null,
        restricoes_alimentares: c.restricoes_alimentares || null,
        vip_autoridades:        c.vip_autoridades        || null,
        observacoes:            c.observacoes            || null,
        motivo_descarte:        c.motivo_descarte        || null,
        checklist:              c.checklist              || {},
    };
}

// ── Filtros & Ordenação ───────────────────────────────
export function aplicarFiltros() {
    const statusF = document.getElementById('leads-filtro-status')?.value || '';
    const tipoF   = document.getElementById('leads-filtro-tipo')?.value   || '';
    const busca   = (document.getElementById('leads-input-busca')?.value || '').trim().toLowerCase();

    _filtrados = _clientes.filter(c => {
        if (statusF && c.status !== statusF) return false;
        if (tipoF   && c.tipo_evento !== tipoF) return false;
        if (busca && !((c.nome_evento||'').toLowerCase().includes(busca) || (c.quem_contratou||'').toLowerCase().includes(busca))) return false;
        return true;
    });

    _filtrados.sort((a, b) => {
        const va = a[_ordemCampo] || '', vb = b[_ordemCampo] || '';
        if (va < vb) return _ordemAsc ? -1 : 1;
        if (va > vb) return _ordemAsc ?  1 : -1;
        return 0;
    });

    _paginaAtual = 1;
    _expandidos.clear();
    _renderizar();
    _atualizarKPIs();
}

export function ordenarPor(campo) {
    if (_ordemCampo === campo) { _ordemAsc = !_ordemAsc; }
    else { _ordemCampo = campo; _ordemAsc = true; }
    document.querySelectorAll('#leads-tabela-body ~ * .sort-icon, .leads-sort-icon').forEach(el => el.textContent = '↕');
    document.querySelectorAll('.leads-th').forEach(th => th.classList.remove('sorted'));
    const icon = document.getElementById('leads-sort-' + campo);
    if (icon) { icon.textContent = _ordemAsc ? '↑' : '↓'; icon.parentElement.classList.add('sorted'); }
    aplicarFiltros();
}

export function mudarPorPagina() {
    _porPagina = parseInt(document.getElementById('leads-por-pagina')?.value || 10);
    _paginaAtual = 1;
    _renderizar();
}

// ── Renderizar tabela ─────────────────────────────────
function _renderizar() {
    const tbody = document.getElementById('leads-tabela-body');
    const vazio = document.getElementById('leads-estado-vazio');
    const total = _filtrados.length;

    const countEl = document.getElementById('leads-tabela-count');
    if (countEl) countEl.textContent = `${total} cliente${total !== 1 ? 's' : ''}`;

    if (total === 0) {
        if (tbody) tbody.innerHTML = '';
        if (vazio) vazio.style.display = 'block';
        const pag = document.getElementById('leads-paginacao');
        if (pag) pag.style.display = 'none';
        return;
    }
    if (vazio) vazio.style.display = 'none';
    const pag = document.getElementById('leads-paginacao');
    if (pag) pag.style.display = 'flex';

    const inicio = (_paginaAtual - 1) * _porPagina;
    const fim    = Math.min(inicio + _porPagina, total);
    const pagina = _filtrados.slice(inicio, fim);

    if (tbody) {
        tbody.innerHTML = pagina.map(c => {
            const expandido = _expandidos.has(c.id);
            return `
            <tr class="linha-evento ${expandido ? 'expandida' : ''}" onclick="leadsToggleExpandir('${c.id}')" id="leads-linha-${c.id}">
                <td class="td-seta"><span class="seta-expand">▼</span></td>
                <td class="nome-evento-cell">${_esc(c.nome_evento) || '—'}</td>
                <td class="quem-contratou-cell">${_esc(c.quem_contratou) || '—'}</td>
                <td class="data-evento-cell">${_fmtData(c.data_inicio, c.data_fim)}</td>
                <td>
                    <span class="badge-status ${_classeStatus(c.status)}"
                          onclick="event.stopPropagation(); leadsAbrirModalStatus('${c.id}')">
                        ${_labelStatus(c.status)}
                    </span>
                </td>
            </tr>
            <tr class="linha-detalhes" id="leads-detalhes-tr-${c.id}">
                <td colspan="5">
                    <div class="painel-detalhes ${expandido ? 'aberto' : ''}" id="leads-painel-${c.id}">
                        ${_renderizarPainel(c)}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    _renderizarPaginacao(total, inicio, fim);
}

function _renderizarPainel(c) {
    const fones    = (c.telefones && c.telefones.length > 0) ? c.telefones : [''];
    const checklist = c.checklist || {};

    return `
    <div class="secoes-grid" onclick="event.stopPropagation()">

        <!-- DADOS PESSOAIS -->
        <div class="secao-card">
            <div class="secao-header"><div class="secao-icone azul">👤</div><span class="secao-titulo">Dados Pessoais</span></div>
            <div class="secao-body">
                <div class="linha-dois">
                    <div class="campo-grupo"><label class="campo-label">Nome do Evento</label>
                        <input type="text" class="campo-input" value="${_esc(c.nome_evento)}" oninput="leadsAtualizarCampo('${c.id}','nome_evento',this.value)" placeholder="Nome do evento"></div>
                    <div class="campo-grupo"><label class="campo-label">Quem Contratou</label>
                        <input type="text" class="campo-input" value="${_esc(c.quem_contratou)}" oninput="leadsAtualizarCampo('${c.id}','quem_contratou',this.value)" placeholder="Nome completo"></div>
                </div>
                <div class="linha-dois">
                    <div class="campo-grupo"><label class="campo-label">Documento (CPF/CNPJ)</label>
                        <input type="text" class="campo-input" value="${_esc(c.documento)}" oninput="leadsAtualizarCampo('${c.id}','documento',this.value)" placeholder="000.000.000-00"></div>
                    <div class="campo-grupo"><label class="campo-label">E-mail</label>
                        <input type="email" class="campo-input" value="${_esc(c.email)}" oninput="leadsAtualizarCampo('${c.id}','email',this.value)" placeholder="email@exemplo.com"></div>
                </div>
                <div class="campo-grupo"><label class="campo-label">Telefone(s) / WhatsApp</label>
                    <div class="fones-lista" id="leads-fones-${c.id}">
                        ${fones.map((f, i) => `
                        <div class="fone-row">
                            <input type="tel" class="campo-input" value="${_esc(f)}" onchange="leadsAtualizarFone('${c.id}',${i},this.value)" placeholder="(00) 00000-0000">
                            ${i === 0
                                ? `<button class="btn-add-fone" onclick="leadsAdicionarFone('${c.id}')" title="Adicionar">＋</button>`
                                : `<button class="btn-rem-fone" onclick="leadsRemoverFone('${c.id}',${i})" title="Remover">✕</button>`}
                        </div>`).join('')}
                    </div>
                </div>
                <div class="campo-grupo"><label class="campo-label">Contato de Emergência</label>
                    <input type="text" class="campo-input" value="${_esc(c.contato_emergencia)}" oninput="leadsAtualizarCampo('${c.id}','contato_emergencia',this.value)" placeholder="Nome e telefone de emergência"></div>
                <div class="campo-grupo"><label class="campo-label">Como Conheceu o Espaço</label>
                    <select class="campo-input" onchange="leadsAtualizarCampo('${c.id}','como_conheceu',this.value)">
                        ${['','Instagram','Facebook','Google','Site VENTSY','Indicação de amigo','Já conhecia','Outro'].map(o => `<option value="${o}" ${c.como_conheceu===o?'selected':''}>${o||'Selecionar...'}</option>`).join('')}
                    </select></div>
            </div>
        </div>

        <!-- DADOS DO EVENTO -->
        <div class="secao-card">
            <div class="secao-header"><div class="secao-icone rosa">🎉</div><span class="secao-titulo">Dados do Evento</span></div>
            <div class="secao-body">
                <div class="linha-dois">
                    <div class="campo-grupo"><label class="campo-label">Tipo de Evento</label>
                        <select class="campo-input" onchange="leadsAtualizarCampo('${c.id}','tipo_evento',this.value)">
                            ${['Casamento','Aniversário','Corporativo','Formatura','Batizado','Outro'].map(o=>`<option value="${o}" ${c.tipo_evento===o?'selected':''}>${o}</option>`).join('')}
                        </select></div>
                    <div class="campo-grupo"><label class="campo-label">Formato da Recepção</label>
                        <select class="campo-input" onchange="leadsAtualizarCampo('${c.id}','formato_recepcao',this.value)">
                            ${['','Coquetel','Jantar sentado','Buffet franco-americano','Churrasco','Misto'].map(o=>`<option value="${o}" ${c.formato_recepcao===o?'selected':''}>${o||'Selecionar...'}</option>`).join('')}
                        </select></div>
                </div>
                <div class="campo-grupo"><label class="campo-label">Datas do Evento</label>
                    <div class="datas-container">
                        <div class="campo-grupo"><label class="campo-label" style="font-size:.65rem">Data Início</label>
                            <input type="date" class="campo-input" value="${c.data_inicio||''}" min="${_hoje()}" onchange="leadsAtualizarCampo('${c.id}','data_inicio',this.value);leadsValidarDatas('${c.id}')"></div>
                        <div class="campo-grupo"><label class="campo-label" style="font-size:.65rem">Data Fim</label>
                            <input type="date" class="campo-input" value="${c.data_fim||''}" min="${c.data_inicio||_hoje()}" onchange="leadsAtualizarCampo('${c.id}','data_fim',this.value)"></div>
                    </div></div>
                <div class="linha-dois">
                    <div class="campo-grupo"><label class="campo-label">Horário Início</label>
                        <input type="time" class="campo-input" value="${c.horario_inicio||''}" onchange="leadsAtualizarCampo('${c.id}','horario_inicio',this.value)"></div>
                    <div class="campo-grupo"><label class="campo-label">Horário Fim</label>
                        <input type="time" class="campo-input" value="${c.horario_fim||''}" onchange="leadsAtualizarCampo('${c.id}','horario_fim',this.value)"></div>
                </div>
                <div class="linha-dois">
                    <div class="campo-grupo"><label class="campo-label">Convidados Adultos</label>
                        <input type="number" class="campo-input" value="${c.qtd_adultos||''}" min="0" onchange="leadsAtualizarCampo('${c.id}','qtd_adultos',this.value)" placeholder="0"></div>
                    <div class="campo-grupo"><label class="campo-label">Convidados Crianças</label>
                        <input type="number" class="campo-input" value="${c.qtd_criancas||''}" min="0" onchange="leadsAtualizarCampo('${c.id}','qtd_criancas',this.value)" placeholder="0"></div>
                </div>
                <div class="campo-grupo"><label class="campo-label">Atrações / Nomes Principais</label>
                    <textarea class="campo-input" rows="2" onchange="leadsAtualizarCampo('${c.id}','atracoes',this.value)">${_esc(c.atracoes)}</textarea></div>
                <div class="linha-dois">
                    <div class="campo-grupo"><label class="campo-label">Horário de Montagem</label>
                        <input type="text" class="campo-input" value="${_esc(c.horario_montagem)}" onchange="leadsAtualizarCampo('${c.id}','horario_montagem',this.value)" placeholder="Ex: 10h do dia anterior"></div>
                    <div class="campo-grupo"><label class="campo-label">Horário de Desmontagem</label>
                        <input type="text" class="campo-input" value="${_esc(c.horario_desmontagem)}" onchange="leadsAtualizarCampo('${c.id}','horario_desmontagem',this.value)" placeholder="Ex: 09h do dia seguinte"></div>
                </div>
            </div>
        </div>

        <!-- SERVIÇOS & ESTRUTURA -->
        <div class="secao-card">
            <div class="secao-header"><div class="secao-icone verde">🔧</div><span class="secao-titulo">Serviços & Estrutura</span></div>
            <div class="secao-body">
                <div class="campo-grupo"><label class="campo-label">Serviços Contratados da Casa</label>
                    <textarea class="campo-input" rows="2" onchange="leadsAtualizarCampo('${c.id}','servicos_casa',this.value)">${_esc(c.servicos_casa)}</textarea></div>
                <div class="campo-grupo"><label class="campo-label">Fornecedores Externos</label>
                    <textarea class="campo-input" rows="2" onchange="leadsAtualizarCampo('${c.id}','fornecedores',this.value)">${_esc(c.fornecedores)}</textarea></div>
                <div class="campo-grupo"><label class="campo-label">Necessidades Técnicas</label>
                    <textarea class="campo-input" rows="2" onchange="leadsAtualizarCampo('${c.id}','necessidades_tecnicas',this.value)">${_esc(c.necessidades_tecnicas)}</textarea></div>
                <div class="campo-grupo"><label class="campo-label">Check-in de Materiais do Cliente</label>
                    <textarea class="campo-input" rows="2" onchange="leadsAtualizarCampo('${c.id}','checkin_materiais',this.value)">${_esc(c.checkin_materiais)}</textarea></div>
            </div>
        </div>

        <!-- FINANCEIRO -->
        <div class="secao-card">
            <div class="secao-header"><div class="secao-icone amarelo">💰</div><span class="secao-titulo">Financeiro</span></div>
            <div class="secao-body">
                <div class="linha-dois">
                    <div class="campo-grupo"><label class="campo-label">Valor Total do Contrato</label>
                        <input type="text" class="campo-input" value="${_esc(c.valor_total)}" oninput="leadsAtualizarCampo('${c.id}','valor_total',this.value)" placeholder="R$ 0,00"></div>
                    <div class="campo-grupo"><label class="campo-label">Forma de Pagamento</label>
                        <select class="campo-input" onchange="leadsAtualizarCampo('${c.id}','forma_pagamento',this.value)">
                            ${['','Pix','Parcelamento','Cartão de crédito','Dinheiro','Misto'].map(o=>`<option value="${o}" ${c.forma_pagamento===o?'selected':''}>${o||'Selecionar...'}</option>`).join('')}
                        </select></div>
                </div>
                <div class="campo-grupo"><label class="campo-label">Parcelas / Datas de Vencimento</label>
                    <div class="parcelas-lista" id="leads-parcelas-${c.id}">${_renderizarParcelas(c)}</div>
                    <button class="btn-add-parcela" onclick="leadsAdicionarParcela('${c.id}')">＋ Adicionar parcela</button>
                </div>
                <div class="campo-grupo"><label class="campo-label">Taxas Extras</label>
                    <textarea class="campo-input" rows="2" onchange="leadsAtualizarCampo('${c.id}','taxas_extras',this.value)">${_esc(c.taxas_extras)}</textarea></div>
            </div>
        </div>

        <!-- EXPERIÊNCIA & VIP -->
        <div class="secao-card">
            <div class="secao-header"><div class="secao-icone roxo">⭐</div><span class="secao-titulo">Experiência & Convidados</span></div>
            <div class="secao-body">
                <div class="campo-grupo"><label class="campo-label">Restrições Alimentares</label>
                    <textarea class="campo-input" rows="2" onchange="leadsAtualizarCampo('${c.id}','restricoes_alimentares',this.value)">${_esc(c.restricoes_alimentares)}</textarea></div>
                <div class="campo-grupo"><label class="campo-label">Lista VIP / Autoridades</label>
                    <textarea class="campo-input" rows="2" onchange="leadsAtualizarCampo('${c.id}','vip_autoridades',this.value)">${_esc(c.vip_autoridades)}</textarea></div>
                <div class="campo-grupo"><label class="campo-label">Observações Gerais</label>
                    <textarea class="campo-input" rows="3" onchange="leadsAtualizarCampo('${c.id}','observacoes',this.value)">${_esc(c.observacoes)}</textarea></div>
            </div>
        </div>

        <!-- CHECKLIST -->
        <div class="secao-card">
            <div class="secao-header"><div class="secao-icone laranja">✅</div><span class="secao-titulo">Checklist Operacional</span></div>
            <div class="secao-body">
                <div class="checklist-grid">
                    ${[
                        ['contrato','Contrato assinado'],['sinal','Sinal / entrada pago'],
                        ['visita','Visita ao local realizada'],['briefing','Briefing completo e aprovado'],
                        ['fornecedores','Fornecedores confirmados'],['ecad','ECAD (direitos musicais) tratado'],
                        ['layout','Layout de mesas definido e enviado'],['confirmacao','Confirmação final enviada ao cliente'],
                    ].map(([key,label]) => `
                    <label class="check-item">
                        <input type="checkbox" ${checklist[key]?'checked':''} onchange="leadsAtualizarChecklist('${c.id}','${key}',this.checked)">
                        <span>${label}</span>
                    </label>`).join('')}
                </div>
            </div>
        </div>

    </div>
    <div class="painel-acoes">
        <button class="btn-outline" onclick="leadsConfirmarExcluir('${c.id}')" style="color:#dc2626;border-color:#dc2626;">🗑️ Excluir</button>
        <button class="btn-outline" onclick="leadsExportarClientePDF('${c.id}')">📄 Exportar PDF</button>
        <button class="btn-primary" onclick="leadsSalvarCliente('${c.id}')">💾 Salvar Alterações</button>
    </div>`;
}

function _renderizarParcelas(c) {
    if (!c.parcelas || c.parcelas.length === 0) return '';
    return c.parcelas.map((p, i) => `
    <div class="parcela-row" id="leads-parcela-${c.id}-${i}">
        <input type="text" class="campo-input" value="${_esc(p.desc||'')}" placeholder="Descrição (ex: 1ª parcela)" onchange="leadsAtualizarParcela('${c.id}',${i},'desc',this.value)">
        <input type="date" class="campo-input" value="${p.vencimento||''}" onchange="leadsAtualizarParcela('${c.id}',${i},'vencimento',this.value)">
        <button class="btn-rem-fone" onclick="leadsRemoverParcela('${c.id}',${i})">✕</button>
    </div>`).join('');
}

// ── Ações no painel expandido ─────────────────────────
export function toggleExpandir(id) {
    if (_expandidos.has(id)) { _expandidos.delete(id); } else { _expandidos.add(id); }
    const linha  = document.getElementById('leads-linha-' + id);
    const painel = document.getElementById('leads-painel-' + id);
    if (linha)  linha.classList.toggle('expandida', _expandidos.has(id));
    if (painel) painel.classList.toggle('aberto',   _expandidos.has(id));
}

export function atualizarCampo(id, campo, valor) {
    const c = _clientes.find(x => x.id === id);
    if (!c) return;
    c[campo] = valor;
    if (campo === 'nome_evento') {
        const el = document.querySelector(`#leads-linha-${id} .nome-evento-cell`);
        if (el) el.textContent = valor || '—';
    }
    if (campo === 'quem_contratou') {
        const el = document.querySelector(`#leads-linha-${id} .quem-contratou-cell`);
        if (el) el.textContent = valor || '—';
    }
    if (campo === 'data_inicio' || campo === 'data_fim') {
        const el = document.querySelector(`#leads-linha-${id} .data-evento-cell`);
        if (el) el.textContent = _fmtData(c.data_inicio, c.data_fim);
    }
}

export function atualizarFone(id, idx, valor) {
    const c = _clientes.find(x => x.id === id);
    if (c) { if (!c.telefones) c.telefones = []; c.telefones[idx] = valor; }
}

export function adicionarFone(id) {
    const c = _clientes.find(x => x.id === id);
    if (!c) return;
    if (!c.telefones) c.telefones = [''];
    c.telefones.push('');
    const container = document.getElementById('leads-fones-' + id);
    const i = c.telefones.length - 1;
    const div = document.createElement('div');
    div.className = 'fone-row';
    div.innerHTML = `
        <input type="tel" class="campo-input" value="" onchange="leadsAtualizarFone('${id}',${i},this.value)" placeholder="(00) 00000-0000">
        <button class="btn-rem-fone" onclick="leadsRemoverFone('${id}',${i})" title="Remover">✕</button>`;
    container?.appendChild(div);
}

export function removerFone(id, idx) {
    const c = _clientes.find(x => x.id === id);
    if (c && c.telefones) {
        c.telefones.splice(idx, 1);
        const painel = document.getElementById('leads-painel-' + id);
        if (painel) painel.innerHTML = _renderizarPainel(c);
    }
}

export function adicionarParcela(id) {
    const c = _clientes.find(x => x.id === id);
    if (!c) return;
    if (!c.parcelas) c.parcelas = [];
    c.parcelas.push({ desc: '', vencimento: '' });
    const container = document.getElementById('leads-parcelas-' + id);
    if (container) {
        const i = c.parcelas.length - 1;
        const div = document.createElement('div');
        div.className = 'parcela-row';
        div.id = `leads-parcela-${id}-${i}`;
        div.innerHTML = `
            <input type="text" class="campo-input" value="" placeholder="Descrição" onchange="leadsAtualizarParcela('${id}',${i},'desc',this.value)">
            <input type="date" class="campo-input" value="" onchange="leadsAtualizarParcela('${id}',${i},'vencimento',this.value)">
            <button class="btn-rem-fone" onclick="leadsRemoverParcela('${id}',${i})">✕</button>`;
        container.appendChild(div);
    }
}

export function atualizarParcela(id, idx, campo, valor) {
    const c = _clientes.find(x => x.id === id);
    if (c && c.parcelas?.[idx]) c.parcelas[idx][campo] = valor;
}

export function removerParcela(id, idx) {
    const c = _clientes.find(x => x.id === id);
    if (c && c.parcelas) {
        c.parcelas.splice(idx, 1);
        const painel = document.getElementById('leads-painel-' + id);
        if (painel) painel.innerHTML = _renderizarPainel(c);
    }
}

export function registrarUpload(id, campo, input) {
    if (input.files?.[0]) {
        const c = _clientes.find(x => x.id === id);
        if (c) c[campo] = input.files[0].name;
        mostrarToast(`📎 Arquivo "${input.files[0].name}" registrado!`);
    }
}

export function atualizarChecklist(id, campo, valor) {
    const c = _clientes.find(x => x.id === id);
    if (c) { if (!c.checklist) c.checklist = {}; c.checklist[campo] = valor; }
}

export function validarDatas(id) {
    const c = _clientes.find(x => x.id === id);
    if (!c || !c.data_inicio || !c.data_fim) return;
    if (c.data_fim < c.data_inicio) {
        c.data_fim = c.data_inicio;
        mostrarToast('⚠️ A data final foi ajustada para não ser anterior à de início.');
        const painel = document.getElementById('leads-painel-' + id);
        if (painel) painel.innerHTML = _renderizarPainel(c);
    }
}

// ── Salvar / Excluir ─────────────────────────────────
export async function salvarCliente(id) {
    const c = _clientes.find(x => x.id === id);
    if (!c) return;
    const btn = document.querySelector(`#leads-painel-${id} .btn-primary`);
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }
    try {
        const { error } = await sb.from('clientes_eventos').update(_montarPayload(c)).eq('id', id).eq('usuario_id', _usuarioId);
        if (error) throw error;
        mostrarToast('✅ Dados salvos com sucesso!');
    } catch (err) {
        console.error('Erro ao salvar:', err);
        mostrarToast('❌ Erro ao salvar. Tente novamente.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Alterações'; }
    }
}

export async function confirmarExcluir(id) {
    if (!confirm('Tem certeza que deseja excluir este cliente/evento?')) return;
    try {
        const { error } = await sb.from('clientes_eventos').delete().eq('id', id).eq('usuario_id', _usuarioId);
        if (error) throw error;
        _clientes = _clientes.filter(x => x.id !== id);
        _expandidos.delete(id);
        aplicarFiltros();
        mostrarToast('🗑️ Cliente removido.');
    } catch (err) {
        console.error('Erro ao excluir:', err);
        mostrarToast('❌ Erro ao excluir.', 'erro');
    }
}

// ── Modal Novo Cliente ────────────────────────────────
export function abrirModalNovo() {
    ['leads-novo-nome-evento','leads-novo-quem-contratou'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const tipo = document.getElementById('leads-novo-tipo'); if (tipo) tipo.value = '';
    const st   = document.getElementById('leads-novo-status'); if (st) st.value = 'lead';
    document.getElementById('leads-modal-novo')?.classList.add('aberto');
}

export function fecharModalNovo() {
    document.getElementById('leads-modal-novo')?.classList.remove('aberto');
}

export async function criarClienteModal() {
    const nome = document.getElementById('leads-novo-nome-evento')?.value.trim();
    const quem = document.getElementById('leads-novo-quem-contratou')?.value.trim();
    if (!nome || !quem) { mostrarToast('⚠️ Preencha nome e quem contratou.'); return; }

    const btn = document.querySelector('#leads-modal-novo .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Criando...'; }
    try {
        const novoCliente = {
            usuario_id:     _usuarioId,
            nome_evento:    nome,
            quem_contratou: quem,
            tipo_evento:    document.getElementById('leads-novo-tipo')?.value   || null,
            status:         document.getElementById('leads-novo-status')?.value || 'lead',
            telefones: [], parcelas: [], checklist: {},
        };
        const { data, error } = await sb.from('clientes_eventos').insert(novoCliente).select().single();
        if (error) throw error;
        _clientes.unshift(_normalizar(data));
        fecharModalNovo();
        aplicarFiltros();
        mostrarToast(`✅ "${nome}" criado com sucesso!`);
    } catch (err) {
        console.error('Erro ao criar:', err);
        mostrarToast('❌ Erro ao criar cliente.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Criar Cliente'; }
    }
}

// ── Modal Status ─────────────────────────────────────
export function abrirModalStatus(id) {
    _clienteEditandoStatus = id;
    const c = _clientes.find(x => x.id === id);
    const el = document.getElementById('leads-modal-status-nome');
    if (el) el.textContent = c ? c.nome_evento : '—';
    document.querySelectorAll('#leads-modal-status .opcao-status').forEach(el => {
        el.classList.toggle('selecionado', el.dataset.status === (c?.status || ''));
    });
    document.getElementById('leads-modal-status')?.classList.add('aberto');
}

export function fecharModalStatus() {
    document.getElementById('leads-modal-status')?.classList.remove('aberto');
    _clienteEditandoStatus = null;
}

export async function selecionarStatus(el) {
    if (_clienteEditandoStatus === null) return;
    const id = _clienteEditandoStatus;
    const novoStatus = el.dataset.status;
    const c = _clientes.find(x => x.id === id);
    if (!c) return;
    fecharModalStatus();
    try {
        const { error } = await sb.from('clientes_eventos').update({ status: novoStatus }).eq('id', id).eq('usuario_id', _usuarioId);
        if (error) throw error;
        c.status = novoStatus;
        _renderizar();
        _atualizarKPIs();
        mostrarToast(`✅ Status: ${_labelStatus(novoStatus)}`);
    } catch (err) {
        console.error('Erro ao atualizar status:', err);
        mostrarToast('❌ Erro ao atualizar status.', 'erro');
    }
}

// ── KPIs ─────────────────────────────────────────────
function _atualizarKPIs() {
    const grupos = {
        negociando:  ['lead','consultada','visita','negociacao','reserva'],
        contratados: ['contratado','briefing','pronto','montagem'],
        finalizados: ['finalizado','pos'],
        perdidos:    ['perdido','recontactar'],
    };
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('leads-kpi-total',       _clientes.length);
    set('leads-kpi-negociando',  _clientes.filter(c => grupos.negociando.includes(c.status)).length);
    set('leads-kpi-contratados', _clientes.filter(c => grupos.contratados.includes(c.status)).length);
    set('leads-kpi-finalizados', _clientes.filter(c => grupos.finalizados.includes(c.status)).length);
    set('leads-kpi-perdidos',    _clientes.filter(c => grupos.perdidos.includes(c.status)).length);
}

// ── Paginação ────────────────────────────────────────
function _renderizarPaginacao(total, inicio, fim) {
    const totalPags = Math.ceil(total / _porPagina);
    const info = document.getElementById('leads-paginacao-info');
    if (info) info.textContent = `Mostrando ${inicio+1}–${fim} de ${total} cliente${total!==1?'s':''}`;
    const btns = document.getElementById('leads-paginacao-btns');
    if (!btns) return;
    let html = `<button class="btn-pag" onclick="leadsIrParaPagina(${_paginaAtual-1})" ${_paginaAtual===1?'disabled':''}>‹</button>`;
    const maxBtns = 5;
    let i1 = Math.max(1, _paginaAtual - Math.floor(maxBtns/2));
    let i2 = Math.min(totalPags, i1 + maxBtns - 1);
    if (i2-i1 < maxBtns-1) i1 = Math.max(1, i2-maxBtns+1);
    for (let p = i1; p <= i2; p++) html += `<button class="btn-pag ${p===_paginaAtual?'ativo':''}" onclick="leadsIrParaPagina(${p})">${p}</button>`;
    html += `<button class="btn-pag" onclick="leadsIrParaPagina(${_paginaAtual+1})" ${_paginaAtual===totalPags?'disabled':''}>›</button>`;
    btns.innerHTML = html;
}

export function irParaPagina(p) {
    const totalPags = Math.ceil(_filtrados.length / _porPagina);
    if (p < 1 || p > totalPags) return;
    _paginaAtual = p; _expandidos.clear(); _renderizar();
}

// ── Exportar ─────────────────────────────────────────
export function exportarExcel() {
    if (_filtrados.length === 0) { mostrarToast('⚠️ Nenhum cliente para exportar.'); return; }
    const dados = _filtrados.map(c => ({
        'Nome do Evento': c.nome_evento, 'Quem Contratou': c.quem_contratou,
        'Tipo': c.tipo_evento, 'Status': _labelStatus(c.status),
        'Data Início': c.data_inicio, 'Data Fim': c.data_fim,
        'E-mail': c.email, 'Telefone': (c.telefones||[]).join(', '),
        'Adultos': c.qtd_adultos, 'Crianças': c.qtd_criancas,
        'Valor Total': c.valor_total, 'Forma de Pagamento': c.forma_pagamento,
        'Observações': c.observacoes,
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes e Eventos');
    XLSX.writeFile(wb, `ventsy-clientes-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
    mostrarToast(`📊 ${_filtrados.length} clientes exportados!`);
}

export function exportarPDF() {
    if (_filtrados.length === 0) { mostrarToast('⚠️ Nenhum cliente para exportar.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.setFont(undefined,'bold');
    doc.text('VENTSY — Clientes & Eventos', 14, 18);
    doc.setFontSize(9); doc.setFont(undefined,'normal');
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} • ${_filtrados.length} cliente(s)`, 14, 25);
    let y=35, x=14;
    const cols = ['Nome do Evento','Quem Contratou','Data','Status','Tipo','Contato'];
    const colW = [60,50,30,35,30,50];
    doc.setFillColor(255,56,92); doc.setTextColor(255);
    doc.rect(x, y-5, colW.reduce((a,b)=>a+b,0), 10, 'F');
    doc.setFontSize(8); doc.setFont(undefined,'bold');
    cols.forEach((col,i) => { doc.text(col, x+2, y+1); x+=colW[i]; });
    doc.setTextColor(0); doc.setFont(undefined,'normal');
    _filtrados.forEach((c,idx) => {
        y+=10; x=14;
        if (y>185) { doc.addPage(); y=20; }
        if (idx%2===0) { doc.setFillColor(248,248,248); doc.rect(14,y-5,colW.reduce((a,b)=>a+b,0),10,'F'); }
        [c.nome_evento||'—',c.quem_contratou||'—',c.data_inicio||'—',_labelStatus(c.status).replace(/[^\w\s]/g,'').trim(),c.tipo_evento||'—',(c.telefones||[''])[0]||c.email||'—']
            .forEach((v,i) => { doc.text(String(v).substring(0,25), x+2, y+1); x+=colW[i]; });
    });
    doc.save(`ventsy-clientes-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.pdf`);
    mostrarToast('📄 PDF exportado!');
}

export function exportarClientePDF(id) {
    const c = _clientes.find(x => x.id === id);
    if (!c) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setFont(undefined,'bold');
    doc.text(c.nome_evento || 'Evento', 14, 20);
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(150);
    doc.text(`Status: ${_labelStatus(c.status)} • Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    doc.setTextColor(0);
    const secoes = [
        ['DADOS PESSOAIS',[['Quem Contratou',c.quem_contratou],['Documento',c.documento],['E-mail',c.email],['Telefone(s)',(c.telefones||[]).join(', ')],['Como Conheceu',c.como_conheceu]]],
        ['DADOS DO EVENTO',[['Tipo',c.tipo_evento],['Formato',c.formato_recepcao],['Data Início',c.data_inicio],['Data Fim',c.data_fim],['Horário',`${c.horario_inicio||'—'} às ${c.horario_fim||'—'}`],['Convidados',`${c.qtd_adultos||0} adultos, ${c.qtd_criancas||0} crianças`]]],
        ['FINANCEIRO',[['Valor Total',c.valor_total],['Forma Pagamento',c.forma_pagamento],['Taxas Extras',c.taxas_extras]]],
        ['OBSERVAÇÕES',[['Restrições Alimentares',c.restricoes_alimentares],['VIP / Autoridades',c.vip_autoridades],['Observações',c.observacoes]]],
    ];
    let y=40;
    secoes.forEach(([titulo,campos]) => {
        if (y>260) { doc.addPage(); y=20; }
        doc.setFillColor(255,245,247); doc.rect(14,y-4,182,8,'F');
        doc.setFont(undefined,'bold'); doc.setFontSize(9); doc.setTextColor(255,56,92);
        doc.text(titulo,16,y+1);
        doc.setFont(undefined,'normal'); doc.setTextColor(0); y+=10;
        campos.forEach(([label,val]) => {
            if (!val) return;
            if (y>275) { doc.addPage(); y=20; }
            doc.setFontSize(7.5); doc.setTextColor(150); doc.text(label+':', 16, y);
            doc.setTextColor(0); doc.setFontSize(8.5);
            const linhas = doc.splitTextToSize(String(val), 150);
            doc.text(linhas, 60, y); y+=5*linhas.length+2;
        }); y+=4;
    });
    doc.save(`ventsy-${(c.nome_evento||'evento').replace(/\s+/g,'-').toLowerCase()}.pdf`);
    mostrarToast(`📄 PDF de "${c.nome_evento}" exportado!`);
}

// ── Setup listeners dos modais ────────────────────────
function _setupModais() {
    document.getElementById('leads-modal-status')?.addEventListener('click', e => {
        if (e.target === document.getElementById('leads-modal-status')) fecharModalStatus();
    });
    document.getElementById('leads-modal-novo')?.addEventListener('click', e => {
        if (e.target === document.getElementById('leads-modal-novo')) fecharModalNovo();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { fecharModalStatus(); fecharModalNovo(); }
    });
}
