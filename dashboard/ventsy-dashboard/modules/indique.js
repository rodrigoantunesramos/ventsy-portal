// ─────────────────────────────────────────
//  VENTSY — Módulo: Programa de Indicação
// ─────────────────────────────────────────
import { sb } from '../js/api.js';
import { state } from '../js/state.js';
import { mostrarToast } from '../js/ui.js';

// ── Init ──────────────────────────────────────────────
export async function init() {
    const userId = state.user?.id;

    // Busca perfil para pegar o seucodigo
    let seuCodigo = '???';
    try {
        const { data: perfil } = await sb
            .from('usuarios')
            .select('seucodigo')
            .eq('id', userId)
            .single();
        seuCodigo = perfil?.seucodigo || '???';
    } catch(_) {}

    // Preenche código e link
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

    set('indique-codigo-valor', seuCodigo);
    setVal('indique-link-ref', `ventsy.com/anunciar?ref=${seuCodigo}`);

    // Busca indicações da view
    let lista = [];
    try {
        const { data, error } = await sb
            .from('v_indicacoes_dashboard')
            .select('*')
            .eq('indicador_id', userId)
            .order('data', { ascending: false });

        if (error) console.error('Erro ao carregar indicações:', error.message);

        lista = (data || []).map(i => ({
            propriedade:     i.propriedade,
            data:            i.data,
            status:          i.status,
            statusLabel:     i.status_label,
            recompensa:      i.recompensa,
            recompensaLabel: i.recompensa_label,
        }));
    } catch(_) {}

    _renderizarIndicacoes(lista);

    // Contadores
    const creditos = lista.filter(i => i.recompensa === 'ganho').length;
    set('indique-total-indicados',   lista.length);
    set('indique-total-publicaram',  lista.filter(i => i.status !== 'pendente').length);
    set('indique-total-creditos',    creditos + (creditos === 1 ? ' Mês' : ' Meses'));

    _exposeGlobals();
}

function _exposeGlobals() {
    window.indiqueCopiarCodigo = copiarCodigo;
    window.indiqueCopiarLink   = copiarLink;
    window.indiqueEnviarWhats  = enviarWhats;
    window.indiqueEnviarEmail  = enviarEmail;
}

// ── Renderiza tabela ───────────────────────────────────
function _renderizarIndicacoes(lista) {
    const tbody = document.getElementById('indique-tbody');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="indique-tabela-vazia">
                        <span>🔗</span>
                        Nenhuma indicação ainda. Compartilhe seu link e comece a ganhar!
                    </div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = lista.map(item => `
        <tr>
            <td><strong>${item.propriedade || '—'}</strong></td>
            <td>${item.data || '—'}</td>
            <td><span class="status-pilula ${item.status || 'pendente'}">${item.statusLabel || '—'}</span></td>
            <td>
                ${item.recompensa === 'ganho'
                    ? `<span class="ganho">✅ ${item.recompensaLabel}</span>`
                    : `<span class="em-espera">${item.recompensaLabel || '—'}</span>`
                }
            </td>
        </tr>`).join('');
}

// ── Copiar código ─────────────────────────────────────
export function copiarCodigo() {
    const codigo = document.getElementById('indique-codigo-valor')?.textContent;
    const btn    = document.getElementById('indique-btn-copiar-codigo');
    if (!codigo || codigo === '???') return;
    navigator.clipboard.writeText(codigo).then(() => {
        if (btn) { btn.textContent = '✅ Copiado!'; btn.classList.add('copiado'); }
        mostrarToast('🎟️ Código copiado! Agora é só passar para quem você quer indicar.');
        setTimeout(() => {
            if (btn) { btn.textContent = '📋 Copiar'; btn.classList.remove('copiado'); }
        }, 2500);
    });
}

// ── Copiar link ───────────────────────────────────────
export function copiarLink() {
    const link = document.getElementById('indique-link-ref')?.value;
    const btn  = document.getElementById('indique-btn-copiar');
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
        if (btn) { btn.textContent = '✅ Copiado!'; btn.classList.add('copiado'); }
        mostrarToast('📋 Link copiado para a área de transferência!');
        setTimeout(() => {
            if (btn) { btn.textContent = '📋 Copiar'; btn.classList.remove('copiado'); }
        }, 2500);
    });
}

// ── Compartilhar WhatsApp ─────────────────────────────
export function enviarWhats() {
    const link = document.getElementById('indique-link-ref')?.value || '';
    const msg  = `Estou anunciando meu espaço na plataforma VENTSY. Eles conectam clientes que procuram lugares para eventos. Se você tem um espaço, pode anunciar também: https://${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── Compartilhar E-mail ───────────────────────────────
export function enviarEmail() {
    const link    = document.getElementById('indique-link-ref')?.value || '';
    const subject = 'Convite para anunciar na VENTSY';
    const body    = `Olá!\n\nEstou anunciando meu espaço na plataforma VENTSY, que conecta clientes que buscam locais para eventos com proprietários de espaços.\n\nSe você tem um espaço, pode anunciar também usando meu link:\nhttps://${link}\n\nAbraços!`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
