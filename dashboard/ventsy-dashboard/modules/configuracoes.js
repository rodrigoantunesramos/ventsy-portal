// ─────────────────────────────────────────
//  VENTSY — Módulo: Configurações
// ─────────────────────────────────────────
import { sb } from '../js/api.js';
import { state } from '../js/state.js';
import { mostrarToast } from '../js/ui.js';

let _userId = null;

// ── Init ──────────────────────────────────────────────
export async function init() {
    _userId = state.user?.id;
    const user = state.user;

    // Carrega perfil completo
    let perfil = {};
    try {
        const { data } = await sb.from('usuarios').select('*').eq('id', _userId).single();
        perfil = data || {};
    } catch(_) {}

    const nome       = perfil.nome       || '';
    const usuario    = perfil.usuario    || '';
    const nascimento = perfil.nascimento || '';
    const documento  = perfil.documento  || '';
    const telefone   = perfil.telefone   || '';
    const inicial    = (nome || user.email).split(' ')[0][0]?.toUpperCase() || '?';

    // Avatar grande
    const avatarEl = document.getElementById('cfg-avatar-grande');
    if (avatarEl) avatarEl.textContent = inicial;

    // Nomes de exibição
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

    set('cfg-perfil-nome-display', nome || '—');
    set('cfg-perfil-email-display', user.email);

    // Campos do formulário
    setVal('cfg-campo-nome',       nome);
    setVal('cfg-campo-usuario',    usuario);
    setVal('cfg-campo-email',      user.email);
    setVal('cfg-campo-telefone',   telefone);
    setVal('cfg-campo-nascimento', nascimento);
    setVal('cfg-campo-documento',  documento);

    // Carrega preferências de notificação do localStorage
    try {
        const prefs = JSON.parse(localStorage.getItem('ventsy_notificacoes') || '{}');
        const checkIf = (id, def) => {
            const el = document.getElementById(id);
            if (el) el.checked = id in prefs ? prefs[id] : def;
        };
        checkIf('cfg-notif-lead-email',    true);
        checkIf('cfg-notif-lead-whatsapp', false);
        checkIf('cfg-notif-visitas',       false);
        checkIf('cfg-notif-promo',         true);
        checkIf('cfg-notif-relatorio',     true);
    } catch(_) {}

    _exposeGlobals();
    _setupModais();
}

function _exposeGlobals() {
    window.cfgSalvarPerfil           = salvarPerfil;
    window.cfgAlterarSenha           = alterarSenha;
    window.cfgEnviarLinkRedefinicao  = enviarLinkRedefinicao;
    window.cfgCalcularForcaSenha     = calcularForcaSenha;
    window.cfgToggleSenha            = toggleSenha;
    window.cfgSalvarNotificacoes     = salvarNotificacoes;
    window.cfgAbrirModal2FA          = abrirModal2FA;
    window.cfgAtivar2FA              = ativar2FA;
    window.cfgEncerrarSessoes        = encerrarSessoes;
    window.cfgAbrirModalExcluir      = abrirModalExcluir;
    window.cfgValidarExclusao        = validarExclusao;
    window.cfgConfirmarExclusao      = confirmarExclusao;
    window.cfgPreviewAvatar          = previewAvatarPerfil;
    window.cfgFecharModal            = fecharModal;
}

// ── Salvar perfil ─────────────────────────────────────
export async function salvarPerfil() {
    const g = id => document.getElementById(id)?.value?.trim() || '';
    const nome      = g('cfg-campo-nome');
    const usuario   = g('cfg-campo-usuario').replace('@', '');
    const telefone  = g('cfg-campo-telefone');
    const nascimento = g('cfg-campo-nascimento');
    const documento  = g('cfg-campo-documento');

    if (!nome) { mostrarToast('⚠️ Preencha seu nome completo.'); return; }

    const { error } = await sb.from('usuarios')
        .update({ nome, usuario, telefone, nascimento, documento })
        .eq('id', _userId);

    if (error) {
        mostrarToast('❌ Erro ao salvar. Tente novamente.', 'erro');
        console.error(error);
    } else {
        const ini = nome.split(' ')[0][0]?.toUpperCase() || '?';
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
        set('cfg-perfil-nome-display', nome);
        set('cfg-avatar-grande', ini);
        // Atualiza também a sidebar global
        set('sidebar-nome',   nome);
        set('avatar-inicial', ini);
        set('sidebar-avatar', ini);
        set('drop-nome',      nome);
        set('sidebar-handle', usuario ? '@' + usuario : '');
        mostrarToast('✅ Perfil atualizado com sucesso!');
    }
}

// ── Alterar senha ─────────────────────────────────────
export async function alterarSenha() {
    const nova      = document.getElementById('cfg-nova-senha')?.value;
    const confirmar = document.getElementById('cfg-confirmar-senha')?.value;

    if (!nova || nova.length < 8) { mostrarToast('⚠️ A senha deve ter pelo menos 8 caracteres.'); return; }
    if (nova !== confirmar)       { mostrarToast('⚠️ As senhas não coincidem.'); return; }

    const { error } = await sb.auth.updateUser({ password: nova });
    if (error) {
        mostrarToast(`❌ Erro ao alterar senha: ${error.message}`, 'erro');
    } else {
        const el1 = document.getElementById('cfg-nova-senha');
        const el2 = document.getElementById('cfg-confirmar-senha');
        if (el1) el1.value = '';
        if (el2) el2.value = '';
        calcularForcaSenha('');
        mostrarToast('✅ Senha alterada com sucesso!');
    }
}

export async function enviarLinkRedefinicao() {
    const email = state.user?.email;
    if (!email) return;
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) { mostrarToast('❌ Erro ao enviar link.', 'erro'); }
    else        { mostrarToast(`📧 Link de redefinição enviado para ${email}`); }
}

// ── Força da senha ────────────────────────────────────
export function calcularForcaSenha(senha) {
    let forca = 0;
    if (senha.length >= 8)         forca++;
    if (/[A-Z]/.test(senha))       forca++;
    if (/[0-9]/.test(senha))       forca++;
    if (/[^A-Za-z0-9]/.test(senha)) forca++;

    const cores  = ['#eee','#ff385c','#f9a825','#43a047','#1e88e5'];
    const labels = ['','Senha fraca','Pode melhorar','Boa senha','Senha forte! 💪'];

    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('cfg-forca-' + i);
        if (el) el.style.background = i <= forca ? cores[forca] : '#eee';
    }
    const lbl = document.getElementById('cfg-forca-label');
    if (lbl) lbl.textContent = senha ? labels[forca] : 'Digite a nova senha';
}

export function toggleSenha(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'password') { el.type = 'text';     btn.textContent = '🙈'; }
    else                        { el.type = 'password'; btn.textContent = '👁'; }
}

// ── Notificações ──────────────────────────────────────
export function salvarNotificacoes() {
    const prefs = {
        lead_email: document.getElementById('cfg-notif-lead-email')?.checked,
        lead_wpp:   document.getElementById('cfg-notif-lead-whatsapp')?.checked,
        visitas:    document.getElementById('cfg-notif-visitas')?.checked,
        promo:      document.getElementById('cfg-notif-promo')?.checked,
        relatorio:  document.getElementById('cfg-notif-relatorio')?.checked,
    };
    localStorage.setItem('ventsy_notificacoes', JSON.stringify(prefs));
    mostrarToast('✅ Preferências de notificação salvas!');
}

// ── 2FA ───────────────────────────────────────────────
export function abrirModal2FA() {
    document.getElementById('cfg-modal-2fa')?.classList.add('aberto');
}

export function ativar2FA(metodo) {
    fecharModal('cfg-modal-2fa');
    const nomes = { sms: 'SMS', email: 'E-mail', app: 'App Autenticador' };
    const badge = document.getElementById('cfg-badge-2fa');
    if (badge) { badge.textContent = '● Configurado via ' + nomes[metodo]; badge.className = 'badge-status badge-ativo'; }
    mostrarToast(`🛡️ 2FA ativado via ${nomes[metodo]}!`);
}

// ── Sessões ───────────────────────────────────────────
export async function encerrarSessoes() {
    await sb.auth.signOut({ scope: 'global' });
    mostrarToast('🔒 Todas as sessões foram encerradas. Faça login novamente.');
    setTimeout(() => window.location.href = '../login.html', 2500);
}

// ── Excluir conta ─────────────────────────────────────
export function abrirModalExcluir() {
    const inp = document.getElementById('cfg-input-confirma-excluir');
    if (inp) inp.value = '';
    validarExclusao('');
    document.getElementById('cfg-modal-excluir')?.classList.add('aberto');
}

export function validarExclusao(valor) {
    const btn = document.getElementById('cfg-btn-confirma-excluir');
    if (!btn) return;
    const ok = valor.trim().toUpperCase() === 'EXCLUIR';
    btn.disabled       = !ok;
    btn.style.opacity  = ok ? '1' : '0.4';
    btn.style.cursor   = ok ? 'pointer' : 'not-allowed';
}

export async function confirmarExclusao() {
    mostrarToast('🗑️ Solicitação de exclusão registrada. Em breve nossa equipe entrará em contato.');
    fecharModal('cfg-modal-excluir');
}

// ── Avatar preview ────────────────────────────────────
export function previewAvatarPerfil(input) {
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
        const el = document.getElementById('cfg-avatar-grande');
        if (el) el.innerHTML = `<img src="${e.target.result}" alt="Avatar">`;
    };
    reader.readAsDataURL(input.files[0]);
}

// ── Modais ────────────────────────────────────────────
export function fecharModal(id) {
    document.getElementById(id)?.classList.remove('aberto');
}

function _setupModais() {
    document.querySelectorAll('.cfg-modal-overlay').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) m.classList.remove('aberto'); });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape')
            document.querySelectorAll('.cfg-modal-overlay.aberto').forEach(m => m.classList.remove('aberto'));
    });
}
