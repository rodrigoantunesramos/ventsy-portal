// ─────────────────────────────────────────
//  VENTSY — Módulo: Fotos do Espaço
// ─────────────────────────────────────────
import { sb } from '../js/api.js';
import { state } from '../js/state.js';
import { mostrarToast } from '../js/ui.js';

// ── Estado do módulo ─────────────────────────────────
let PROP_ID                  = null;
let PLANO_ATIVO              = 'basico';
let destaqueState            = [null, null, null, null, null]; // 5 slots
let fotosParaExcluirDoStorage = [];
let abaAtiva                 = 'espaco';
let destaqueSlotAtivo        = null;
let contadorSecao            = 0;
let contadorSecaoEvento      = 0;

const SUPA_URL = 'https://hxvlfalgrduitevbhqvq.supabase.co';

// ── Init ─────────────────────────────────────────────
export async function init() {
    // Reutiliza prop_id já carregado pelo app.js
    PROP_ID = state.propId || null;

    // Plano
    if (state.assinatura) {
        PLANO_ATIVO = (state.assinatura.plano_ativo || state.assinatura.plano || 'basico').toLowerCase();
    }

    // Se ainda não tiver prop_id, tenta buscar
    if (!PROP_ID) {
        try {
            const { data } = await sb.from('propriedades')
                .select('id').eq('usuario_id', state.user?.id).single();
            PROP_ID = data?.id || null;
        } catch (_) {}
    }

    const aviso = document.getElementById('fotos-aviso-sem-prop');
    if (aviso) aviso.style.display = PROP_ID ? 'none' : 'flex';

    _atualizarBannerPlano();
    await carregarFotosSalvas();
    _exposeGlobals();
}

// ── Expor globais para onclick= no HTML ─────────────
function _exposeGlobals() {
    window.fotosMudarAba          = mudarAba;
    window.fotosAtivarSlot        = ativarSlot;
    window.fotosLimparDestaquePos = limparDestaquePos;
    window.fotosCriarSecao        = criarSecao;
    window.fotosExcluirSecao      = excluirSecao;
    window.fotosToggleSecao       = toggleSecao;
    window.fotosAtualizarContador = atualizarContador;
    window.fotosOnDragOver        = onDragOver;
    window.fotosOnDragLeave       = onDragLeave;
    window.fotosOnDrop            = onDrop;
    window.fotosHandleFiles       = handleFiles;
    window.fotosRemoverFoto       = removerFoto;
    window.fotosSalvarTudo        = salvarTudo;
}

// ── Banner de plano ───────────────────────────────────
function _atualizarBannerPlano() {
    const el = document.getElementById('fotos-banner-plano');
    if (!el) return;
    el.className = 'fotos-banner-plano ' + PLANO_ATIVO;
    if (PLANO_ATIVO === 'basico') {
        el.innerHTML = '🔒 <strong>Plano Básico:</strong> máximo de 5 fotos. <a href="../planos.html" style="color:inherit;font-weight:700">Fazer upgrade →</a>';
        el.style.display = 'flex';
    } else if (PLANO_ATIVO === 'pro') {
        el.innerHTML = '🚀 <strong>Plano Pro:</strong> fotos ilimitadas. Para vídeos, faça upgrade para Ultra. <a href="../planos.html" style="color:inherit;font-weight:700">Ver planos →</a>';
        el.style.display = 'flex';
    } else {
        el.innerHTML = '⭐ <strong>Plano Ultra:</strong> fotos e vídeos ilimitados.';
        el.style.display = 'flex';
    }
}

function _contarTotalFotos() {
    return document.querySelectorAll('#fotos-lista-secoes .foto-card').length;
}

// ── Tabs ──────────────────────────────────────────────
export function mudarAba(tipo) {
    abaAtiva = tipo;
    document.querySelectorAll('.fotos-aba').forEach(a => a.classList.remove('ativa'));
    document.getElementById('fotos-aba-' + tipo)?.classList.add('ativa');
    document.querySelectorAll('.fotos-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('fotos-tab-' + tipo)?.classList.add('active');
    if (destaqueSlotAtivo !== null) _desativarSlot();
}

// ── Painel de destaque ────────────────────────────────
export function ativarSlot(pos) {
    if (destaqueSlotAtivo === pos) { _desativarSlot(); return; }
    destaqueSlotAtivo = pos;
    document.querySelectorAll('.fotos-destaque-slot').forEach(s => s.classList.remove('aguardando'));
    document.getElementById('fotos-dslot-' + pos)?.classList.add('aguardando');
    const hint = document.getElementById('fotos-slot-hint');
    if (hint) hint.textContent = `↓ Clique em uma foto abaixo para colocar na posição ${pos}`;
    document.querySelectorAll('#fotos-lista-secoes .foto-card').forEach(c => c.classList.add('selecionavel'));
}

function _desativarSlot() {
    destaqueSlotAtivo = null;
    document.querySelectorAll('.fotos-destaque-slot').forEach(s => s.classList.remove('aguardando'));
    const hint = document.getElementById('fotos-slot-hint');
    if (hint) hint.textContent = '';
    document.querySelectorAll('.foto-card').forEach(c => c.classList.remove('selecionavel'));
}

function _atribuirFotoAoSlot(src, pos) {
    destaqueState.forEach((s, i) => { if (s === src) destaqueState[i] = null; });
    destaqueState[pos - 1] = src;
    _desativarSlot();
    const hint = document.getElementById('fotos-slot-hint');
    if (hint) { hint.textContent = `✓ Foto definida na posição ${pos}`; setTimeout(() => { if (hint) hint.textContent = ''; }, 2200); }
    _atualizarBadgesDestaque();
    _atualizarPainelDestaque();
    mostrarToast(`⭐ Foto definida como posição ${pos}`);
}

export function limparDestaquePos(pos) {
    destaqueState[pos - 1] = null;
    _atualizarBadgesDestaque();
    _atualizarPainelDestaque();
}

function _atualizarBadgesDestaque() {
    const srcToPos = {};
    destaqueState.forEach((src, i) => { if (src) srcToPos[src] = i + 1; });
    document.querySelectorAll('.foto-card').forEach(card => {
        const badge = card.querySelector('.fotos-badge-destaque');
        const pos   = srcToPos[card.dataset.src];
        if (badge) {
            if (pos) { badge.textContent = '⭐ ' + pos; badge.style.display = 'flex'; }
            else      { badge.style.display = 'none'; }
        }
    });
}

function _atualizarPainelDestaque() {
    for (let pos = 1; pos <= 5; pos++) {
        const src   = destaqueState[pos - 1];
        const img   = document.getElementById('fotos-dslot-img-' + pos);
        const empty = document.getElementById('fotos-dslot-empty-' + pos);
        const slot  = document.getElementById('fotos-dslot-' + pos);
        if (!img || !empty || !slot) continue;
        if (src) {
            img.src = src; img.style.display = 'block';
            empty.style.display = 'none'; slot.classList.add('preenchido');
        } else {
            img.style.display = 'none'; empty.style.display = 'flex'; slot.classList.remove('preenchido');
        }
    }
}

// ── Seções ────────────────────────────────────────────
export function criarSecao(titulo = '') {
    const isEvento = abaAtiva === 'evento';
    const prefix   = isEvento ? 'fev-secao-' : 'fsecao-';
    const listId   = isEvento ? 'fotos-lista-secoes-evento' : 'fotos-lista-secoes';
    const phId     = isEvento ? 'fotos-placeholder-evento'  : 'fotos-placeholder';

    if (isEvento) contadorSecaoEvento++; else contadorSecao++;
    const id = prefix + (isEvento ? contadorSecaoEvento : contadorSecao);

    document.getElementById(phId).style.display = 'none';
    const lista = document.getElementById(listId);
    const card  = document.createElement('div');
    card.className  = 'secao-fotos';
    card.id         = id;
    card.dataset.id  = id;
    card.dataset.tipo = abaAtiva;

    const acceptAttr  = PLANO_ATIVO === 'ultra' ? 'image/*,video/*' : 'image/*';
    const btnLabel    = PLANO_ATIVO === 'ultra' ? 'Selecionar fotos/vídeos' : 'Selecionar fotos';
    const dropIcon    = PLANO_ATIVO === 'ultra' ? '🎬' : '📷';
    const dropText    = PLANO_ATIVO === 'ultra' ? 'Arraste fotos ou vídeos aqui' : 'Arraste as fotos aqui ou clique para selecionar';
    const placeholder = isEvento
        ? 'Ex: Casamento, Aniversário, Corporativo...'
        : 'Ex: Área Externa, Lareira, Salão Principal...';

    card.innerHTML = `
        <div class="secao-header">
            <span class="secao-drag-handle" title="Arrastar para reordenar">⠿</span>
            <div class="secao-titulo-wrap">
                <input type="text" class="secao-titulo-input" placeholder="${placeholder}" value="${titulo}" oninput="fotosAtualizarContador('${id}')">
                <div class="secao-contador" id="fotos-contador-${id}">0 fotos</div>
            </div>
            <div class="secao-acoes">
                <button class="btn-icon collapse-btn" title="Recolher" onclick="fotosToggleSecao('${id}')">▼</button>
                <button class="btn-icon danger" title="Excluir seção" onclick="fotosExcluirSecao('${id}')">🗑️</button>
            </div>
        </div>
        <div class="secao-body" id="fotos-body-${id}">
            <div class="fotos-grid" id="fotos-grid-${id}"></div>
            <div class="drop-zone" id="fotos-drop-${id}"
                ondragover="fotosOnDragOver(event,'${id}')"
                ondragleave="fotosOnDragLeave('${id}')"
                ondrop="fotosOnDrop(event,'${id}')">
                <span class="drop-zone-icon">${dropIcon}</span>
                <p>${dropText}</p>
                <button class="btn-selecionar-fotos" onclick="document.getElementById('fotos-file-${id}').click()">${btnLabel}</button>
                <input type="file" id="fotos-file-${id}" multiple accept="${acceptAttr}" hidden onchange="fotosHandleFiles(this.files,'${id}')">
            </div>
        </div>`;
    lista.appendChild(card);
    if (!titulo) setTimeout(() => card.querySelector('.secao-titulo-input').focus(), 100);
    atualizarContador(id);
    return id;
}

export function excluirSecao(id) {
    const card = document.getElementById(id);
    if (!card) return;
    card.style.opacity    = '0.4';
    card.style.transform  = 'scale(0.97)';
    card.style.transition = 'all 0.25s';
    const isEvento = id.startsWith('fev-');
    const listId   = isEvento ? 'fotos-lista-secoes-evento' : 'fotos-lista-secoes';
    const phId     = isEvento ? 'fotos-placeholder-evento'  : 'fotos-placeholder';
    setTimeout(() => {
        card.querySelectorAll('.foto-card').forEach(fc => {
            const url  = fc.dataset.src;
            const base = `${SUPA_URL}/storage/v1/object/public/fotos-dashboard/`;
            if (url && url.startsWith(base)) fotosParaExcluirDoStorage.push(url.replace(base, ''));
        });
        card.remove();
        if (!document.querySelector(`#${listId} .secao-fotos`))
            document.getElementById(phId).style.display = 'block';
        mostrarToast('🗑️ Seção removida.');
    }, 250);
}

export function toggleSecao(id) {
    const body = document.getElementById('fotos-body-' + id);
    const btn  = document.querySelector(`#${id} .collapse-btn`);
    if (!body || !btn) return;
    btn.textContent = body.classList.toggle('collapsed') ? '▶' : '▼';
}

export function atualizarContador(id) {
    const grid  = document.getElementById('fotos-grid-' + id);
    const count = grid ? grid.querySelectorAll('.foto-card').length : 0;
    const el    = document.getElementById('fotos-contador-' + id);
    if (el) el.textContent = count + (count === 1 ? ' foto' : ' fotos');
    _atualizarBadgeCapa(id);
}

function _atualizarBadgeCapa(id) {
    const grid = document.getElementById('fotos-grid-' + id);
    if (!grid) return;
    grid.querySelectorAll('.foto-card').forEach((c, i) => {
        const badge = c.querySelector('.badge-capa');
        if (i === 0) {
            if (!badge) { const b = document.createElement('span'); b.className = 'badge-capa'; b.textContent = 'Capa'; c.appendChild(b); }
        } else { if (badge) badge.remove(); }
    });
}

// ── Drag & drop entre seções ──────────────────────────
export function onDragOver(e, id)  { e.preventDefault(); document.getElementById('fotos-drop-' + id)?.classList.add('dragover'); }
export function onDragLeave(id)    { document.getElementById('fotos-drop-' + id)?.classList.remove('dragover'); }
export function onDrop(e, id) {
    e.preventDefault();
    document.getElementById('fotos-drop-' + id)?.classList.remove('dragover');
    if (e.dataTransfer.files?.length > 0) handleFiles(e.dataTransfer.files, id);
}

// ── Upload ────────────────────────────────────────────
export async function handleFiles(files, secaoId) {
    let fileArray = Array.from(files).filter(f => {
        if (f.type.startsWith('image/')) return true;
        if (f.type.startsWith('video/') && PLANO_ATIVO === 'ultra') return true;
        return false;
    });

    if (fileArray.length === 0) {
        if (PLANO_ATIVO !== 'ultra' && Array.from(files).some(f => f.type.startsWith('video/')))
            mostrarToast('🔒 Vídeos disponíveis apenas no Plano Ultra.');
        return;
    }

    // Limite Básico: só seções do espaço
    if (PLANO_ATIVO === 'basico' && !secaoId.startsWith('fev-')) {
        const totalAtual = _contarTotalFotos();
        const restantes  = Math.max(0, 5 - totalAtual);
        if (restantes === 0) { mostrarToast('🔒 Limite de 5 fotos atingido. Faça upgrade.'); return; }
        if (fileArray.length > restantes) {
            mostrarToast(`⚠️ Plano Básico: apenas mais ${restantes} foto(s) permitida(s).`);
            fileArray = fileArray.slice(0, restantes);
        }
    }

    const session = await sb.auth.getSession().then(r => r.data.session);
    if (!session) { mostrarToast('❌ Sessão expirada. Faça login novamente.'); return; }
    const userId = session.user.id;

    const dropZone = document.getElementById('fotos-drop-' + secaoId);
    const originalContent = dropZone?.innerHTML;
    if (dropZone) { dropZone.innerHTML = `<span class="drop-zone-icon">⏳</span><p>Enviando ${fileArray.length} arquivo(s)...</p>`; dropZone.style.pointerEvents = 'none'; }

    let successCount = 0;
    for (const file of fileArray) {
        try {
            const timestamp = Date.now();
            const safeBase  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '');
            let uploadBlob = file, contentType = file.type, ext = file.name.split('.').pop().toLowerCase();

            if (file.type.startsWith('image/')) {
                uploadBlob  = await _comprimirParaBlob(file, 1200, 0.82);
                contentType = 'image/jpeg';
                ext         = 'jpg';
            }

            const filePath = `${userId}/${secaoId}/${timestamp}-${safeBase}.${ext}`;
            const { error: uploadError } = await sb.storage
                .from('fotos-dashboard')
                .upload(filePath, uploadBlob, { contentType, cacheControl: '3600', upsert: false });
            if (uploadError) throw new Error(uploadError.message);

            const { data: urlData } = sb.storage.from('fotos-dashboard').getPublicUrl(filePath);
            adicionarFotoNaSecao(urlData.publicUrl, secaoId, file.name);
            successCount++;
        } catch (e) {
            console.error('Erro ao enviar arquivo:', e.message || e);
            mostrarToast(`❌ Erro: ${e.message}`, 'erro');
        }
    }

    if (dropZone) { dropZone.innerHTML = originalContent; dropZone.style.pointerEvents = 'auto'; }
    if (successCount > 0) mostrarToast(`✅ ${successCount} arquivo(s) enviado(s)! Clique em Salvar.`);
}

function _comprimirParaBlob(file, maxPx, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = e => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                let { width, height } = img;
                if (width > maxPx || height > maxPx) {
                    const ratio = Math.min(maxPx / width, maxPx / height);
                    width  = Math.round(width  * ratio);
                    height = Math.round(height * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao gerar blob')), 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ── Foto card ─────────────────────────────────────────
export function adicionarFotoNaSecao(src, secaoId, nome) {
    const grid = document.getElementById('fotos-grid-' + secaoId);
    if (!grid) return;

    const card      = document.createElement('div');
    card.className  = 'foto-card';
    card.draggable  = true;
    card.dataset.src = src;

    const isVideo = src.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/i) || (nome && nome.match(/\.(mp4|webm|mov|avi|mkv)$/i));
    const mediaEl = isVideo
        ? `<video src="${src}" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;border-radius:10px"></video>`
        : `<img src="${src}" alt="${nome || 'foto'}">`;

    card.innerHTML = `
        ${mediaEl}
        <button class="btn-remover-foto" title="Remover" onclick="fotosRemoverFoto(this,'${secaoId}')">✕</button>
        <div class="fotos-badge-destaque"></div>
    `;

    // Clique para atribuir ao slot ativo (só fotos do espaço)
    if (!secaoId.startsWith('fev-')) {
        card.addEventListener('click', e => {
            if (e.target.closest('.btn-remover-foto')) return;
            if (destaqueSlotAtivo !== null) _atribuirFotoAoSlot(src, destaqueSlotAtivo);
        });
    }

    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('foto-src', src);
        e.dataTransfer.setData('foto-secao', secaoId);
        card.style.opacity = '0.4';
    });
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });

    grid.appendChild(card);
    atualizarContador(secaoId);
    _atualizarBadgesDestaque();
}

export function removerFoto(btn, secaoId) {
    const card = btn.parentElement;
    const url  = card.dataset.src;
    const base = `${SUPA_URL}/storage/v1/object/public/fotos-dashboard/`;
    if (url && url.startsWith(base)) fotosParaExcluirDoStorage.push(url.replace(base, ''));
    card.style.opacity   = '0';
    card.style.transform = 'scale(0.85)';
    card.style.transition = 'all 0.2s';
    setTimeout(() => { card.remove(); atualizarContador(secaoId); }, 200);
}

// ── Salvar ────────────────────────────────────────────
export async function salvarTudo() {
    const btns = document.querySelectorAll('.fotos-btn-salvar, .fotos-btn-salvar-tudo');
    btns.forEach(b => { b.disabled = true; b.textContent = '💾 Salvando...'; });
    try {
        if (!PROP_ID) throw new Error('Propriedade não encontrada. Preencha os dados em Minha Propriedade primeiro.');
        await _sincronizarFotos();
        mostrarToast('✅ Alterações salvas com sucesso!');
    } catch (err) {
        console.error('Erro ao salvar:', err);
        mostrarToast(`❌ ${err.message || 'Erro ao salvar.'}`, 'erro');
    } finally {
        btns.forEach(b => { b.disabled = false; b.textContent = '💾 Salvar'; });
    }
}

async function _sincronizarFotos() {
    // Remove do Storage os arquivos excluídos
    if (fotosParaExcluirDoStorage.length > 0) {
        await sb.storage.from('fotos-dashboard').remove(fotosParaExcluirDoStorage);
        fotosParaExcluirDoStorage = [];
    }

    const fotosParaSalvar = [];
    let ordemGlobal = 6;

    // Destaque (secao='__destaque__')
    destaqueState.forEach((url, i) => {
        if (url) fotosParaSalvar.push({ propriedade_id: PROP_ID, url, secao: '__destaque__', ordem: i + 1, tipo: 'espaco' });
    });

    // Seções regulares
    const destaqueUrls = new Set(destaqueState.filter(Boolean));
    document.querySelectorAll('.secao-fotos').forEach(card => {
        const tipo  = card.dataset.tipo || 'espaco';
        const secao = card.querySelector('.secao-titulo-input')?.value.trim() || 'Sem título';
        card.querySelectorAll('.foto-card').forEach(fc => {
            const url = fc.dataset.src;
            if (url && !(tipo === 'espaco' && destaqueUrls.has(url))) {
                fotosParaSalvar.push({ propriedade_id: PROP_ID, url, secao, ordem: ordemGlobal++, tipo });
            }
        });
    });

    const { error: delErr } = await sb.from('fotos_imovel').delete().eq('propriedade_id', PROP_ID);
    if (delErr) throw delErr;
    if (fotosParaSalvar.length > 0) {
        const { error: insErr } = await sb.from('fotos_imovel').insert(fotosParaSalvar);
        if (insErr) throw insErr;
    }
}

// ── Carregar fotos salvas ─────────────────────────────
async function carregarFotosSalvas() {
    if (!PROP_ID) {
        _criarSecaoNaAba('Área Externa', 'espaco');
        _criarSecaoNaAba('Salão Principal', 'espaco');
        return;
    }

    const { data: fotos, error } = await sb
        .from('fotos_imovel')
        .select('url, secao, ordem, tipo')
        .eq('propriedade_id', PROP_ID)
        .order('ordem');

    if (error || !fotos || fotos.length === 0) {
        _criarSecaoNaAba('Área Externa', 'espaco');
        _criarSecaoNaAba('Salão Principal', 'espaco');
        return;
    }

    const fotosEspaco = fotos.filter(f => f.tipo !== 'evento');
    const fotosEvento = fotos.filter(f => f.tipo === 'evento');

    // Restaura destaque
    const fotosDestaque = fotosEspaco.filter(f => f.secao === '__destaque__').sort((a, b) => a.ordem - b.ordem);
    fotosDestaque.forEach(f => {
        const idx = f.ordem - 1;
        if (idx >= 0 && idx < 5) destaqueState[idx] = f.url;
    });
    if (fotosDestaque.length > 0) _atualizarPainelDestaque();

    // Seções do espaço
    const mapaEspaco = {};
    fotosEspaco.filter(f => f.secao !== '__destaque__').forEach(f => {
        const nome = f.secao || 'Geral';
        (mapaEspaco[nome] = mapaEspaco[nome] || []).push(f.url);
    });
    if (Object.keys(mapaEspaco).length === 0) {
        _criarSecaoNaAba('Área Externa', 'espaco');
        _criarSecaoNaAba('Salão Principal', 'espaco');
    } else {
        Object.entries(mapaEspaco).forEach(([titulo, urls]) => {
            const id = _criarSecaoNaAba(titulo, 'espaco');
            urls.forEach(url => { if (url) adicionarFotoNaSecao(url, id, ''); });
        });
    }

    // Seções de evento
    const mapaEvento = {};
    fotosEvento.forEach(f => {
        const nome = f.secao || 'Evento';
        (mapaEvento[nome] = mapaEvento[nome] || []).push(f.url);
    });
    Object.entries(mapaEvento).forEach(([titulo, urls]) => {
        const id = _criarSecaoNaAba(titulo, 'evento');
        urls.forEach(url => { if (url) adicionarFotoNaSecao(url, id, ''); });
    });

    _atualizarBadgesDestaque();
}

// Helper: cria seção na aba certa sem alterar abaAtiva permanentemente
function _criarSecaoNaAba(titulo, tipo) {
    const prev = abaAtiva;
    abaAtiva = tipo;
    const id = criarSecao(titulo);
    abaAtiva = prev;
    return id;
}
