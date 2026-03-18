// ─────────────────────────────────────────
//  VENTSY — Módulo: Minha Propriedade
//  8 abas: Contato, Sobre, Valores, Endereço,
//          Eventos, FAQ, Serviços, Força do Anúncio
// ─────────────────────────────────────────
import { sb } from '../js/api.js';
import { state } from '../js/state.js';
import { mostrarToast } from '../js/ui.js';

// ── Estado do módulo ─────────────────────────────────
let PROP_ID   = null;
let _mapa     = null;    // instância Leaflet
let _propCache = null;   // última propriedade carregada

// ── Init ─────────────────────────────────────────────
export async function init() {
    PROP_ID = state.propId || null;
    await _carregarPropriedade();
    _setupAutoSave();
    _exposeGlobals();

    // Abre aba pelo hash da URL (ex: #sobre, #endereco)
    const hash = window.location.hash.slice(1);
    const abas = ['contato','sobre','valores','endereco','eventos','faq','servicos','forca'];
    if (abas.includes(hash)) {
        _abrirAba(hash);
        if (hash === 'endereco' && document.getElementById('prop-cidade')?.value) {
            setTimeout(atualizarMapa, 200);
        }
    }
}

function _exposeGlobals() {
    window.propOpenTab          = openTab;
    window.propSalvar           = salvarAlteracoes;
    window.propVerAnuncio       = verAnuncio;
    window.propAdicionarFAQ     = adicionarFAQ;
    window.propAdicionarCusto   = adicionarCustoExtra;
    window.propSelecionarUF     = selecionarUF;
    window.propBuscarCEP        = buscarCEP;
    window.propAtualizarMapa    = atualizarMapa;
    window.propPreviewFoto      = previewFotoResp;
    window.propTermoAcao        = termoAcao;
}

// ── Abas ──────────────────────────────────────────────
export function openTab(evt, tabName) {
    document.querySelectorAll('.prop-tab-content').forEach(t => {
        t.style.display = 'none'; t.classList.remove('active');
    });
    document.querySelectorAll('.prop-tab-link').forEach(l => l.classList.remove('active'));
    _abrirAba(tabName);
    if (evt?.currentTarget) evt.currentTarget.classList.add('active');
}

function _abrirAba(tabName) {
    const tab = document.getElementById('prop-aba-' + tabName);
    if (tab) { tab.style.display = 'block'; tab.classList.add('active'); }
    const btn = document.querySelector(`.prop-tab-link[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    if (tabName === 'endereco') {
        if (_mapa) setTimeout(() => _mapa.invalidateSize(), 150);
        else if (document.getElementById('prop-cidade')?.value) setTimeout(atualizarMapa, 200);
    }
    if (tabName === 'forca' && _propCache) {
        calcularTermometro(_propCache);
    }
}

// ── Carregar propriedade do Supabase ─────────────────
async function _carregarPropriedade() {
    const userId = state.user?.id;
    if (!userId) return;

    const { data: prop } = await sb
        .from('propriedades')
        .select('*')
        .eq('usuario_id', userId)
        .single();

    const btn = document.getElementById('prop-btn-visualizar');
    if (!prop) {
        if (btn) { btn.style.opacity = '0.5'; btn.title = 'Salve os dados primeiro para visualizar o anúncio'; }
        document.getElementById('prop-termo-pct').textContent = '0%';
        document.getElementById('prop-termo-msg').textContent = '⚡ Preencha os dados abaixo para ativar seu anúncio e começar a receber clientes!';
        document.getElementById('prop-termo-itens').innerHTML = `
            <div class="prop-termo-item pendente">
                <div class="prop-termo-icone pendente">⚠️</div>
                <div class="prop-termo-texto">
                    <div class="prop-termo-nome">Cadastro não iniciado</div>
                    <div class="prop-termo-dica">Preencha e salve os dados da propriedade para começar.</div>
                </div>
            </div>`;
        return;
    }

    PROP_ID = prop.id;
    _propCache = prop;

    // Aba 1 — Contato
    _setVal('prop-nome-espaco',      prop.nome);
    _setVal('prop-tipo-propriedade', prop.categoria);
    _setVal('prop-email-contato',    prop.email_contato);
    _setVal('prop-whatsapp',         prop.whatsapp);
    _setVal('prop-telefone',         prop.telefone);
    _setVal('prop-instagram',        prop.instagram);
    _setVal('prop-facebook',         prop.facebook);
    _setVal('prop-tiktok',           prop.tiktok);
    _setVal('prop-youtube',          prop.youtube);
    _setVal('prop-linkedin',         prop.linkedin);
    _setVal('prop-site',             prop.site);
    _setVal('prop-nome-resp',        prop.nome_responsavel);
    if (prop.capacidade != null) {
        const capNum = String(prop.capacidade).replace(/\D/g, '');
        document.getElementById('prop-capacidade').value = capNum || prop.capacidade;
    }
    if (prop.foto_responsavel) {
        document.getElementById('prop-avatar-preview').innerHTML =
            `<img src="${prop.foto_responsavel}" alt="Foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        document.getElementById('prop-foto-resp-data').value = prop.foto_responsavel;
    }

    // Aba 2 — Sobre
    _setVal('prop-descricao', prop.descricao);

    // Aba 3 — Valores
    if (prop.valor_hora)  document.getElementById('prop-valor-hora').value   = prop.valor_hora;
    if (prop.valor_base)  document.getElementById('prop-valor-diaria').value = prop.valor_base;

    // Aba 3 — Custos extras
    _parseArray(prop.custos_extras).forEach(e => adicionarCustoExtra(e.nome || '', e.valor || ''));

    // Aba 4 — Endereço
    _setVal('prop-cep',         prop.cep);
    _setVal('prop-rua',         prop.rua);
    _setVal('prop-numero',      prop.numero);
    _setVal('prop-complemento', prop.complemento);
    _setVal('prop-bairro',      prop.bairro);
    _setVal('prop-cidade',      prop.cidade);
    if (prop.estado) _selecionarUFpelaSigla(prop.estado.trim().toUpperCase());

    // Aba 5 — Eventos
    if (prop.tipo_evento) {
        const tipos = prop.tipo_evento.split(',').map(t => t.trim().toLowerCase());
        document.querySelectorAll('input[name="prop-tipo-evento"]').forEach(cb => {
            cb.checked = tipos.some(t => t.includes(cb.value) || cb.value.includes(t));
        });
    }

    // Aba 6 — Regras de Cobrança + FAQ
    _setVal('prop-regras-preco', prop.regras_preco);
    if (Array.isArray(prop.faq) && prop.faq.length) {
        const lista     = document.getElementById('prop-lista-faq');
        const fixedItem = lista.querySelector('.prop-faq-item[data-fixo]');
        lista.innerHTML = '';
        if (fixedItem) lista.appendChild(fixedItem);
        prop.faq.forEach(f => {
            const item = document.createElement('div');
            item.className = 'prop-faq-item';
            item.innerHTML = `
                <div class="prop-faq-inputs">
                    <input type="text" placeholder="Pergunta..." value="${_esc(f.pergunta)}">
                    <textarea placeholder="Resposta...">${_esc(f.resposta)}</textarea>
                </div>
                <button class="prop-btn-remover-faq" onclick="this.parentElement.remove()">🗑️</button>`;
            lista.appendChild(item);
        });
    }

    // Aba 7 — Comodidades
    const comodsSalvas = _parseArray(prop.comodidades);
    document.querySelectorAll('#prop-aba-servicos .prop-amenidade-check input:not(.prop-svc-extra)').forEach(cb => {
        cb.checked = comodsSalvas.includes(cb.value);
    });

    // Aba 7 — Serviços extras
    const extrasSalvos = _parseArray(prop.servicos_extras);
    document.querySelectorAll('#prop-aba-servicos .prop-svc-extra').forEach(cb => {
        cb.checked = extrasSalvos.includes(cb.value);
    });

    // Botão anúncio
    if (btn) { btn.style.opacity = '1'; btn.title = 'Ver como o cliente vê sua propriedade'; }

    await calcularTermometro(prop);
}

// ── Salvar ────────────────────────────────────────────
export async function salvarAlteracoes() {
    const btn = document.querySelector('.prop-btn-salvar');
    if (btn) { btn.disabled = true; btn.textContent = '💾 Salvando...'; }

    try {
        const session = await sb.auth.getSession().then(r => r.data.session);
        if (!session) throw new Error('Sessão expirada. Faça login novamente.');
        const userId = session.user.id;

        const g = id => document.getElementById(id)?.value?.trim() || '';

        const custosExtras = Array.from(
            document.querySelectorAll('#prop-lista-custos-extras .prop-custo-item')
        ).map(item => {
            const inputs = item.querySelectorAll('input');
            return { nome: inputs[0]?.value.trim() || '', valor: parseFloat(inputs[1]?.value) || 0 };
        }).filter(e => e.nome && e.valor > 0);

        const comodidades = Array.from(
            document.querySelectorAll('#prop-aba-servicos .prop-amenidade-check input:not(.prop-svc-extra):checked')
        ).map(cb => cb.value);

        const servicosExtras = Array.from(
            document.querySelectorAll('#prop-aba-servicos .prop-svc-extra:checked')
        ).map(cb => cb.value);

        const tipos = Array.from(
            document.querySelectorAll('input[name="prop-tipo-evento"]:checked')
        ).map(cb => cb.value);

        const faq = Array.from(
            document.querySelectorAll('#prop-lista-faq .prop-faq-item:not([data-fixo])')
        ).map(item => ({
            pergunta: item.querySelector('input')?.value.trim() || '',
            resposta: item.querySelector('textarea')?.value.trim() || ''
        })).filter(f => f.pergunta);

        const rua = g('prop-rua'), numero = g('prop-numero'), complemento = g('prop-complemento');

        const dadosUpdate = {
            nome:             g('prop-nome-espaco')      || null,
            categoria:        g('prop-tipo-propriedade') || null,
            descricao:        g('prop-descricao')        || null,
            capacidade:       g('prop-capacidade')       || null,
            tipo_evento:      tipos.join(', ')           || null,
            cidade:           g('prop-cidade')           || null,
            estado:           g('prop-uf')               || null,
            valor_base:       g('prop-valor-diaria')     ? parseFloat(g('prop-valor-diaria')) : null,
            valor_hora:       g('prop-valor-hora')       ? parseFloat(g('prop-valor-hora'))   : null,
            whatsapp:         g('prop-whatsapp')         || null,
            telefone:         g('prop-telefone')         || null,
            email_contato:    g('prop-email-contato')    || null,
            instagram:        g('prop-instagram')        || null,
            facebook:         g('prop-facebook')         || null,
            tiktok:           g('prop-tiktok')           || null,
            youtube:          g('prop-youtube')          || null,
            linkedin:         g('prop-linkedin')         || null,
            site:             g('prop-site')             || null,
            nome_responsavel: g('prop-nome-resp')        || null,
            foto_responsavel: document.getElementById('prop-foto-resp-data')?.value || null,
            cep:              g('prop-cep')              || null,
            rua:              rua                        || null,
            numero:           numero                     || null,
            complemento:      complemento                || null,
            bairro:           g('prop-bairro')           || null,
            endereco:         [rua, numero, complemento].filter(Boolean).join(', ') || null,
            regras_preco:     g('prop-regras-preco')     || null,
            comodidades,
            servicos_extras:  servicosExtras,
            custos_extras:    custosExtras,
            faq,
        };

        const { data: existing } = await sb
            .from('propriedades').select('id').eq('usuario_id', userId).maybeSingle();

        let saveError;
        if (existing?.id) {
            PROP_ID = existing.id;
            const res = await sb.from('propriedades').update(dadosUpdate).eq('id', PROP_ID).select('id');
            saveError = res.error;
        } else {
            const res = await sb.from('propriedades').insert({ ...dadosUpdate, usuario_id: userId }).select('id').single();
            saveError = res.error;
            if (res.data?.id) PROP_ID = res.data.id;
        }

        if (saveError) throw saveError;

        // Atualiza cache e termômetro
        _propCache = { ..._propCache, ...dadosUpdate, id: PROP_ID };
        await calcularTermometro(_propCache);
        _atualizarBtnAnuncio();
        mostrarToast('✅ Alterações salvas com sucesso!');

    } catch (err) {
        console.error('Erro ao salvar propriedade:', err);
        mostrarToast(`❌ ${err.message || 'Erro ao salvar.'}`, 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Alterações'; }
    }
}

// ── Termômetro do anúncio ─────────────────────────────
export async function calcularTermometro(prop) {
    let numFotos = 0;
    try {
        const { count } = await sb.from('fotos_imovel')
            .select('id', { count: 'exact', head: true })
            .eq('propriedade_id', prop.id);
        numFotos = count || 0;
    } catch(_) {}

    const criterios = [
        {
            nome: 'Fotos da propriedade',
            ok: numFotos >= 3,
            dica_ok: `${numFotos} foto(s) adicionada(s) — ótimo!`,
            dica_pendente: numFotos === 0
                ? 'Adicione pelo menos 3 fotos. Anúncios com fotos recebem 3x mais cliques.'
                : `Você tem ${numFotos} foto. Adicione mais ${3 - numFotos} para atingir o mínimo recomendado.`,
            acao: () => window.navegar?.('fotos'),
            pts: 30,
        },
        {
            nome: 'Descrição do espaço',
            ok: (prop.descricao || '').trim().length >= 80,
            dica_ok: 'Descrição completa — clientes entendem melhor seu espaço.',
            dica_pendente: !(prop.descricao || '').trim()
                ? 'Adicione uma descrição na aba "Sobre".'
                : `Sua descrição está curta (${(prop.descricao||'').trim().length} caracteres). Tente chegar em 80+.`,
            acao: () => _abrirAba('sobre'),
            pts: 25,
        },
        {
            nome: 'WhatsApp de contato',
            ok: !!(prop.whatsapp || '').trim(),
            dica_ok: 'WhatsApp configurado — clientes podem entrar em contato diretamente.',
            dica_pendente: 'Adicione seu WhatsApp na aba "Contato".',
            acao: () => { _abrirAba('contato'); document.getElementById('prop-whatsapp')?.focus(); },
            pts: 20,
        },
        {
            nome: 'Endereço completo',
            ok: !!(prop.cidade && prop.estado),
            dica_ok: 'Endereço informado — aparece nos resultados de busca por localização.',
            dica_pendente: 'Preencha cidade e estado na aba "Endereço".',
            acao: () => _abrirAba('endereco'),
            pts: 15,
        },
        {
            nome: 'Preço por diária',
            ok: !!(prop.valor_base),
            dica_ok: 'Preço informado — clientes sabem o que esperar antes de contatar.',
            dica_pendente: 'Adicione o valor base por diária na aba "Valores".',
            acao: () => _abrirAba('valores'),
            pts: 10,
        },
    ];

    const scoreTotal = criterios.reduce((acc, c) => acc + (c.ok ? c.pts : 0), 0);
    const cor = scoreTotal >= 80 ? '#16a34a' : scoreTotal >= 50 ? '#d97706' : '#ff385c';
    const msgs = {
        100: '🏆 Parabéns! Seu anúncio está completo e com máxima visibilidade.',
        80:  '🎉 Muito bom! Pequenos ajustes podem aumentar ainda mais seus contatos.',
        50:  '🚀 Bom começo! Complete os itens abaixo para aparecer mais nas buscas.',
        0:   '⚡ Seu anúncio precisa de atenção. Complete os itens abaixo.',
    };
    const msg = msgs[scoreTotal >= 100 ? 100 : scoreTotal >= 80 ? 80 : scoreTotal >= 50 ? 50 : 0];

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('prop-termo-pct', scoreTotal + '%');
    const pctEl = document.getElementById('prop-termo-pct');
    if (pctEl) pctEl.style.color = cor;
    set('prop-termo-msg', msg);

    const bar = document.getElementById('prop-termo-bar');
    if (bar) { bar.style.background = cor; setTimeout(() => { bar.style.width = scoreTotal + '%'; }, 100); }

    const itensEl = document.getElementById('prop-termo-itens');
    if (itensEl) {
        itensEl.innerHTML = criterios.map((c, i) => `
            <div class="prop-termo-item ${c.ok ? 'ok' : 'pendente'}" onclick="${c.ok ? '' : `propTermoAcao(${i})`}">
                <div class="prop-termo-icone ${c.ok ? 'ok' : 'pendente'}">${c.ok ? '✅' : '⚠️'}</div>
                <div class="prop-termo-texto">
                    <div class="prop-termo-nome">${c.nome}</div>
                    <div class="prop-termo-dica">${c.ok ? c.dica_ok : c.dica_pendente}</div>
                </div>
                <span class="prop-termo-pts ${c.ok ? 'ok' : 'pendente'}">+${c.pts}pts</span>
                ${!c.ok ? '<span class="prop-termo-seta">→ Corrigir</span>' : ''}
            </div>`).join('');
    }

    window._propTermoAcoes = criterios.map(c => c.acao);
}

export function termoAcao(i) {
    if (window._propTermoAcoes?.[i]) window._propTermoAcoes[i]();
}

// ── FAQ ───────────────────────────────────────────────
export function adicionarFAQ() {
    const lista = document.getElementById('prop-lista-faq');
    if (!lista) return;
    const item = document.createElement('div');
    item.className = 'prop-faq-item';
    item.innerHTML = `
        <div class="prop-faq-inputs">
            <input type="text" placeholder="Pergunta (ex: Qual o horário limite para som alto?)">
            <textarea placeholder="Resposta..."></textarea>
        </div>
        <button class="prop-btn-remover-faq" onclick="this.parentElement.remove()">🗑️</button>`;
    lista.appendChild(item);
    item.querySelector('input').focus();
}

export function adicionarCustoExtra(nome = '', valor = '') {
    const lista = document.getElementById('prop-lista-custos-extras');
    if (!lista) return;
    const item = document.createElement('div');
    item.className = 'prop-custo-item';
    item.innerHTML = `
        <input type="text" placeholder="Nome do serviço (ex: Limpeza pós-evento)" value="${nome}">
        <input type="number" placeholder="R$ valor" min="0" value="${valor}">
        <button class="prop-btn-remover-faq" onclick="this.parentElement.remove()">🗑️</button>`;
    lista.appendChild(item);
    item.querySelector('input').focus();
}

// ── UF Grid ───────────────────────────────────────────
export function selecionarUF(btn, sigla) {
    document.querySelectorAll('#prop-uf-grid .prop-uf-btn').forEach(b => b.classList.remove('selecionado'));
    if (btn) btn.classList.add('selecionado');
    const inp = document.getElementById('prop-uf');
    if (inp) inp.value = sigla;
}

function _selecionarUFpelaSigla(sigla) {
    const btn = document.querySelector(`#prop-uf-grid .prop-uf-btn[data-uf="${sigla}"]`);
    selecionarUF(btn, sigla);
}

// ── CEP ───────────────────────────────────────────────
export function buscarCEP() {
    const cep = document.getElementById('prop-cep')?.value.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(r => r.json())
        .then(d => {
            if (!d.erro) {
                _setVal('prop-rua',    d.logradouro);
                _setVal('prop-bairro', d.bairro);
                _setVal('prop-cidade', d.localidade);
                _selecionarUFpelaSigla(d.uf);
                document.getElementById('prop-numero')?.focus();
                mostrarToast('📍 Endereço preenchido automaticamente!');
                atualizarMapa();
            }
        })
        .catch(() => {});
}

// ── Mapa Leaflet ──────────────────────────────────────
export function atualizarMapa() {
    const rua    = document.getElementById('prop-rua')?.value.trim();
    const numero = document.getElementById('prop-numero')?.value.trim();
    const bairro = document.getElementById('prop-bairro')?.value.trim();
    const cidade = document.getElementById('prop-cidade')?.value.trim();
    const uf     = document.getElementById('prop-uf')?.value.trim();
    const msg    = document.getElementById('prop-mapa-msg');
    if (!cidade) { if (msg) msg.textContent = '⚠️ Preencha ao menos a cidade para gerar o mapa.'; return; }
    if (msg) msg.textContent = '⏳ Buscando localização...';
    const q = [rua, numero, bairro, cidade, uf, 'Brasil'].filter(Boolean).join(', ');
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
          { headers: { 'Accept-Language': 'pt-BR' } })
        .then(r => r.json())
        .then(res => {
            if (!res.length) { if (msg) msg.textContent = '⚠️ Endereço não encontrado. Verifique os dados.'; return; }
            const lat = parseFloat(res[0].lat), lon = parseFloat(res[0].lon);
            const container = document.getElementById('prop-mapa-leaflet');
            if (_mapa) { _mapa.remove(); _mapa = null; }
            if (container) container.style.display = 'block';
            if (msg) msg.textContent = '';
            if (container && window.L) {
                _mapa = L.map('prop-mapa-leaflet').setView([lat, lon], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    maxZoom: 19
                }).addTo(_mapa);
                L.marker([lat, lon]).addTo(_mapa);
                setTimeout(() => _mapa.invalidateSize(), 300);
            }
        })
        .catch(() => { if (msg) msg.textContent = '⚠️ Não foi possível carregar o mapa.'; });
}

// ── Foto do responsável ───────────────────────────────
export function previewFotoResp(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const MAX = 300;
            let w = img.width, h = img.height;
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else       { w = Math.round(w * MAX / h); h = MAX; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            document.getElementById('prop-avatar-preview').innerHTML =
                `<img src="${dataUrl}" alt="Foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
            document.getElementById('prop-foto-resp-data').value = dataUrl;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
}

// ── Ver anúncio público ───────────────────────────────
export function verAnuncio() {
    if (PROP_ID) {
        window.open('../propriedade.html?id=' + PROP_ID, '_blank');
    } else {
        mostrarToast('⚠️ Salve os dados da propriedade primeiro.');
    }
}

// ── Auto-save de checkboxes ───────────────────────────
function _setupAutoSave() {
    // Auto-save comodidades e serviços extras
    document.querySelectorAll('#prop-aba-servicos .prop-amenidade-check input').forEach(cb => {
        cb.addEventListener('change', async () => {
            if (!PROP_ID) return;
            const comodidades    = Array.from(document.querySelectorAll('#prop-aba-servicos .prop-amenidade-check input:not(.prop-svc-extra):checked')).map(c => c.value);
            const servicosExtras = Array.from(document.querySelectorAll('#prop-aba-servicos .prop-svc-extra:checked')).map(c => c.value);
            const { error } = await sb.from('propriedades').update({ comodidades, servicos_extras: servicosExtras }).eq('id', PROP_ID);
            if (!error) mostrarToast('✅ Serviços salvos!');
        });
    });

    // Auto-save tipos de evento
    document.querySelectorAll('input[name="prop-tipo-evento"]').forEach(cb => {
        cb.addEventListener('change', async () => {
            if (!PROP_ID) return;
            const tipos = Array.from(document.querySelectorAll('input[name="prop-tipo-evento"]:checked')).map(c => c.value);
            const { error } = await sb.from('propriedades').update({ tipo_evento: tipos.join(', ') || null }).eq('id', PROP_ID);
            if (!error) mostrarToast('✅ Eventos salvos!');
        });
    });
}

// ── Botão "Ver Anúncio" ───────────────────────────────
function _atualizarBtnAnuncio() {
    const btn = document.getElementById('prop-btn-visualizar');
    if (!btn) return;
    btn.style.opacity = PROP_ID ? '1' : '0.5';
    btn.title = PROP_ID ? 'Ver como o cliente vê sua propriedade' : 'Salve os dados primeiro';
}

// ── Helpers ───────────────────────────────────────────
function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val != null) el.value = val;
}

function _esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _parseArray(val) {
    if (Array.isArray(val)) return val;
    if (!val) return [];
    if (typeof val === 'string') {
        if (val.startsWith('{')) return val.slice(1,-1).split(',').map(s => s.trim().replace(/^"|"$/g,'')).filter(Boolean);
        try { return JSON.parse(val); } catch(_) {}
    }
    return [];
}
