// ─────────────────────────────────────────
//  VENTSY — app.js  (ponto de entrada)
//  Importa todos os módulos e inicializa a SPA
// ─────────────────────────────────────────
import { getSession, signOut, getPerfil, getAssinatura, getPropriedade, getDados30Dias } from './api.js';
import { sb } from './api.js';
import { state, setState } from './state.js';
import {
    hideLoadingScreen,
    preencherUI,
    toggleAvatar,
    setupAvatarClose,
    toggleSidebar,
    mostrarToast,
    marcarPasso,
    atualizarProgresso,
} from './ui.js';
import { registrarModulo, navegar, rotaInicial } from './router.js';

// ── Importa módulos (lazy boot via router) ────────────
import { init as initFinanceiro } from '../modules/financeiro.js';
import { init as initDocumentos } from '../modules/documentos.js';
import { init as initEquipe     } from '../modules/equipe.js';
import { init as initCalendario } from '../modules/calendario.js';
import { init as initFotos      } from '../modules/fotos.js';
import { init as initMinhaPropriedade } from '../modules/minhapropriedade.js';
import { init as initLeads      } from '../modules/leads.js';
import { init as initPlanos } from '../modules/planos.js';
import { init as initRelatorio } from '../modules/relatorio.js';

// ── Registra inicializadores no router ────────────────
registrarModulo('financeiro', initFinanceiro);
registrarModulo('documentos', initDocumentos);
registrarModulo('equipe',     initEquipe);
registrarModulo('calendario', initCalendario);
registrarModulo('fotos', initFotos);
registrarModulo('minhapropriedade', initMinhaPropriedade);
registrarModulo('leads', initLeads);
registrarModulo('planos', initPlanos);
registrarModulo('relatorio', initRelatorio);



// ── Expor globais para HTML inline ────────────────────
// (funções chamadas por onclick= no HTML)
window.toggleAvatar  = toggleAvatar;
window.toggleSidebar = toggleSidebar;
window.mostrarToast  = mostrarToast;
window.sair = async () => {
    await signOut();
    window.location.href = '../login.html';
};
window.navegar = navegar;
window.solicitarLiberacao = solicitarLiberacao;
window.mudarTab  = mudarTab;

// ── Analytics dashboard ───────────────────────────────
let graficoInst = null, dadosCache = {}, tabAtiva = 'view';

const COR_CHART   = { view:'#ff385c', whatsapp:'#25D366', formulario:'#1a73e8', nota:'#f59e0b' };
const LABEL_CHART = { view:'Visualizações', whatsapp:'Cliques WhatsApp', formulario:'Cliques Formulário', nota:'Avaliação média' };

const { LABELS_30D, KEYS_30D } = (() => {
    const LABELS_30D = [], KEYS_30D = [], hoje = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(hoje); d.setDate(hoje.getDate() - i);
        LABELS_30D.push(d.getDate() + '/' + (d.getMonth()+1));
        KEYS_30D.push(d.toISOString().split('T')[0]);
    }
    return { LABELS_30D, KEYS_30D };
})();

async function carregarMetricas(propId) {
    const inicio = new Date(); inicio.setDate(inicio.getDate() - 30);
    try {
        const { data } = await sb.from('analytics_eventos')
            .select('evento_tipo').eq('propriedade_id', propId).gte('created_at', inicio.toISOString());
        const c = { view:0, whatsapp:0, formulario:0 };
        (data||[]).forEach(e => { if (c[e.evento_tipo] !== undefined) c[e.evento_tipo]++; });
        ['views','whatsapp','formulario'].forEach(id => {
            const el = document.getElementById('m-' + id);
            if (el) { el.textContent = c[id==='views'?'view':id]; el.classList.remove('loading'); }
        });
    } catch (_) {
        ['m-views','m-whatsapp','m-formulario'].forEach(id => {
            const el = document.getElementById(id); if (el) { el.textContent='—'; el.classList.remove('loading'); }
        });
    }
    try {
        const { data: prop } = await sb.from('propriedades').select('avaliacao').eq('id', propId).single();
        const el = document.getElementById('m-nota');
        if (el) { el.textContent = prop?.avaliacao ? Number(prop.avaliacao).toFixed(1) : '—'; el.classList.remove('loading'); }
    } catch (_) {
        const el = document.getElementById('m-nota'); if (el) { el.textContent='—'; el.classList.remove('loading'); }
    }
}

async function buscarDados30Dias(tipo) {
    if (dadosCache[tipo]) return dadosCache[tipo];
    const propId = state.propId;
    if (!propId) { dadosCache[tipo] = new Array(30).fill(0); return dadosCache[tipo]; }
    const inicio = new Date(); inicio.setDate(inicio.getDate() - 30);
    let valores = new Array(30).fill(0);
    try {
        if (tipo === 'nota') {
            const { data } = await sb.from('avaliacoes').select('nota,criado_em').eq('propriedade_id', propId).gte('criado_em', inicio.toISOString());
            const cnt={}, soma={};
            KEYS_30D.forEach(k => { cnt[k]=0; soma[k]=0; });
            (data||[]).forEach(a => { const k=a.criado_em?.split('T')[0]; if (cnt[k]!==undefined) { cnt[k]++; soma[k]+=Number(a.nota)||0; } });
            valores = KEYS_30D.map(k => cnt[k]>0 ? +(soma[k]/cnt[k]).toFixed(2) : null);
        } else {
            const { data } = await sb.from('analytics_eventos').select('created_at').eq('propriedade_id', propId).eq('evento_tipo', tipo).gte('created_at', inicio.toISOString());
            const cnt={}; KEYS_30D.forEach(k => { cnt[k]=0; });
            (data||[]).forEach(e => { const k=e.created_at?.split('T')[0]; if (cnt[k]!==undefined) cnt[k]++; });
            valores = KEYS_30D.map(k => cnt[k]);
        }
    } catch (_) {}
    dadosCache[tipo] = valores;
    return valores;
}

async function mudarTab(btn) {
    const tipo = btn.dataset.tipo;
    if (tipo === tabAtiva) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    tabAtiva = tipo;
    const dados = await buscarDados30Dias(tipo);
    montarGrafico(tipo, dados);
}

function montarGrafico(tipo, dados) {
    const canvas = document.getElementById('graficoAnalytics');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cor = COR_CHART[tipo];
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, cor + '33'); gradient.addColorStop(1, cor + '00');
    const temDados = dados.some(v => v !== null && v > 0);
    const vazioEl = document.getElementById('grafico-vazio');
    if (vazioEl) vazioEl.style.display = temDados ? 'none' : 'block';
    if (graficoInst) { graficoInst.destroy(); graficoInst = null; }
    graficoInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels: LABELS_30D,
            datasets: [{
                label: LABEL_CHART[tipo], data: dados, borderColor: cor, borderWidth: 2.5,
                fill: true, backgroundColor: gradient, tension: 0.4,
                pointRadius: temDados ? 3 : 0, pointBackgroundColor: cor,
                spanGaps: tipo === 'nota',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: tipo!=='nota', min: tipo==='nota'?0:undefined, max: tipo==='nota'?5:undefined, grid: { color:'#f0f0f0' }, ticks: { color:'#999', stepSize: tipo==='nota'?1:undefined } },
                x: { grid: { display: false }, ticks: { color:'#999', maxTicksLimit: 10 } }
            }
        }
    });
}

// ── Solicitar liberação ───────────────────────────────
async function solicitarLiberacao() {
    const btn = document.getElementById('btn-solicitar');
    if (!btn || btn.disabled || btn.classList.contains('enviado')) return;
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
        const session = await getSession();
        await sb.from('solicitacoes_publicacao').upsert(
            { user_id: session.user.id, status:'pendente', criado_em: new Date().toISOString() },
            { onConflict: 'user_id' }
        );
        btn.classList.add('enviado'); btn.textContent = '✅ Solicitação enviada com sucesso!';
        const hint = document.getElementById('solicitar-hint');
        if (hint) hint.textContent = 'Solicitação registrada! Nossa equipe revisará em até 48 horas úteis.';
        mostrarToast('Solicitação enviada! Aguarde o contato da equipe VENTSY.');
    } catch (_) {
        btn.disabled = false; btn.textContent = '🚀 Solicitar liberação de propriedade na plataforma VENTSY';
        mostrarToast('Erro ao enviar. Tente novamente.', 'erro');
    }
}

// ── Verificar passos ──────────────────────────────────
function verificarPassos(prop) {
    const t = v => v !== null && v !== undefined && v !== '';
    marcarPasso(1);
    if (prop?.fotos_destaque?.length >= 5)          marcarPasso(2);
    if (t(prop?.sobre))                              marcarPasso(3);
    if (t(prop?.cep) && t(prop?.rua))               marcarPasso(4);
    if (t(prop?.whatsapp) && t(prop?.email_contato)) marcarPasso(5);
    if (t(prop?.valor_hora) || t(prop?.valor_diaria)) marcarPasso(6);
    if (t(prop?.tipo_evento))                        marcarPasso(7);
    atualizarProgresso();
}

// ── INIT PRINCIPAL ────────────────────────────────────
async function init() {
    try {
        const session = await getSession();
        if (!session) { window.location.href = '../login.html'; return; }

        const user = session.user;
        let nome = user.email, usuario = '';

        // Perfil
        try {
            const perfil = await getPerfil(user.id);
            if (perfil) { nome = perfil.nome || user.email; usuario = perfil.usuario || ''; }
            setState({ perfil });
        } catch (_) {}

        const inicial = nome.split(' ')[0][0]?.toUpperCase() || '?';

        // Assinatura
        let plano = 'basico', validade = null;
        try {
            const assin = await getAssinatura(user.id);
            if (assin) {
                plano    = (assin.plano_ativo || assin.plano || 'basico').toLowerCase();
                validade = assin.fim_periodo  || assin.validade || null;
                setState({ assinatura: assin });
            }
        } catch (_) {}

        // Preencher UI
        preencherUI({ nome, email: user.email, usuario, plano, validade, inicial });
        setState({ user });

        // Propriedade
        try {
            const prop = await getPropriedade(user.id);
            if (prop) {
                setState({ propId: prop.id, propNome: prop.nome, propSlug: prop.slug });
                const slug = prop.slug || prop.id;
                const btnProp = document.getElementById('btn-ver-prop');
                if (btnProp) btnProp.href = '../propriedade/' + slug + '.html';
                const btnTxt = document.getElementById('btn-ver-prop-txt');
                if (btnTxt) btnTxt.textContent = 'Ver: ' + prop.nome;
                await carregarMetricas(prop.id);
                verificarPassos(prop);
                const dados = await buscarDados30Dias('view');
                montarGrafico('view', dados);
            } else {
                ['m-views','m-whatsapp','m-formulario','m-nota'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.textContent = '—'; el.classList.remove('loading'); }
                });
            }
        } catch (_) {}

    } catch (e) {
        console.error('Erro no init:', e);
    } finally {
        hideLoadingScreen();
        setupAvatarClose();
        rotaInicial(); // Navega para a rota do hash atual
    }
}

// ── Arrancar ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
