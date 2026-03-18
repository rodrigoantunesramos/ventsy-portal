// ─────────────────────────────────────────
//  VENTSY — Utilitários de UI compartilhados
// ─────────────────────────────────────────

// ── Toast ─────────────────────────────────
export function mostrarToast(msg, tipo = 'ok') {
    let t = document.getElementById('toast-global');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast-global';
        t.style.cssText = `
            position:fixed; bottom:28px; left:50%; transform:translateX(-50%) translateY(80px);
            background:#0d0d0d; color:#fff; padding:12px 24px; border-radius:10px;
            font-size:.88rem; font-weight:600; z-index:99999;
            box-shadow:0 4px 20px rgba(0,0,0,0.25); transition:transform .3s ease, opacity .3s ease;
            opacity:0; pointer-events:none; white-space:nowrap;
        `;
        document.body.appendChild(t);
    }
    if (tipo === 'erro') t.style.background = '#dc2626';
    else if (tipo === 'aviso') t.style.background = '#d97706';
    else t.style.background = '#0d0d0d';

    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-50%) translateY(80px)';
    }, 3000);
}

// ── Loading screen ────────────────────────
export function hideLoadingScreen() {
    const el = document.getElementById('loading-screen');
    if (el) el.style.display = 'none';
    const main = document.getElementById('main-content');
    if (main) main.style.display = 'flex';
}

// ── Avatar dropdown ───────────────────────
export function toggleAvatar() {
    const m = document.getElementById('avatar-menu');
    if (!m) return;
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

export function setupAvatarClose() {
    document.addEventListener('click', e => {
        if (!e.target.closest('.avatar-container')) {
            const m = document.getElementById('avatar-menu');
            if (m) m.style.display = 'none';
        }
    });
}

// ── Sidebar mobile ────────────────────────
export function toggleSidebar() {
    document.querySelector('.dash-sidebar')?.classList.toggle('aberta');
    document.getElementById('sidebar-overlay')?.classList.toggle('ativo');
}

export function closeSidebar() {
    document.querySelector('.dash-sidebar')?.classList.remove('aberta');
    document.getElementById('sidebar-overlay')?.classList.remove('ativo');
}

// ── Preencher informações do usuário na UI ─
export function preencherUI({ nome, email, usuario, plano, validade, inicial }) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('avatar-inicial', inicial);
    set('drop-nome', nome);
    set('drop-email', email);
    set('sidebar-nome', nome);
    set('sidebar-handle', usuario ? '@' + usuario : '');
    set('hero-nome', nome.split(' ')[0]);

    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.textContent = inicial;

    const emoji = plano === 'ultra' ? '🚀' : plano === 'pro' ? '⭐' : '🏷️';
    set('sidebar-plano-chip', emoji + ' ' + plano);

    if (validade) {
        set('sidebar-validade', 'Válido até ' + new Date(validade).toLocaleDateString('pt-BR'));
    }
}

// ── Passos de conclusão ───────────────────
const _passosCompletos = new Set();

export function marcarPasso(n) {
    _passosCompletos.add(n);
    const el = document.getElementById('passo-' + n);
    if (!el) return;
    el.classList.add('completo');
    const num = el.querySelector('.passo-num');
    if (num) num.textContent = '✓';
    const ac = el.querySelector('.passo-acao');
    if (ac) { ac.className = 'passo-acao verde'; ac.textContent = '✓ Concluído'; }
    atualizarProgresso();
}

export function atualizarProgresso() {
    const total = 7, conc = _passosCompletos.size;
    const el = document.getElementById('passos-progresso');
    if (!el) return;
    el.textContent = conc + ' de ' + total + ' concluídos';
    el.classList.toggle('completo-total', conc >= total);

    const btn = document.getElementById('btn-solicitar');
    const aviso = document.getElementById('solicitar-aviso');
    // Libera o botão apenas se passos 2-5 completos
    const prontos = [2, 3, 4, 5].every(n => _passosCompletos.has(n));
    if (btn) btn.disabled = !prontos;
    if (aviso) aviso.classList.toggle('oculto', prontos);
}

// ── Formatação ────────────────────────────
export function fmtBRL(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtData(iso) {
    return new Date(iso).toLocaleDateString('pt-BR');
}
