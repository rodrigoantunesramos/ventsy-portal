// ─────────────────────────────────────────
//  VENTSY — Camada de API (Supabase)
// ─────────────────────────────────────────
import { SUPA_URL, SUPA_KEY } from './config.js';

const { createClient } = supabase;
export const sb = createClient(SUPA_URL, SUPA_KEY);

// ── Auth ──────────────────────────────────
export async function getSession() {
    const { data: { session } } = await sb.auth.getSession();
    return session;
}

export async function signOut() {
    await sb.auth.signOut();
}

// ── Perfil do usuário ─────────────────────
export async function getPerfil(userId) {
    const { data } = await sb.from('usuarios').select('*').eq('id', userId).single();
    return data;
}

export async function getAssinatura(userId) {
    const { data } = await sb.from('assinaturas')
        .select('plano,validade')
        .eq('user_id', userId)
        .maybeSingle();
    return data;
}

// ── Propriedade ───────────────────────────
export async function getPropriedade(userId) {
    const { data } = await sb.from('propriedades')
        .select('id,nome,slug')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1);
    return data?.[0] || null;
}

// ── Métricas (analytics) ──────────────────
export async function getMetricas(propId) {
    const { data } = await sb.from('metricas')
        .select('tipo,total')
        .eq('prop_id', propId);
    return data || [];
}

export async function getDados30Dias(propId, tipo) {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - 29);

    const { data } = await sb.from('analytics_diario')
        .select('data,quantidade')
        .eq('prop_id', propId)
        .eq('tipo', tipo)
        .gte('data', inicio.toISOString().split('T')[0])
        .order('data', { ascending: true });
    return data || [];
}

// ── Passos de conclusão ───────────────────
export async function verificarPassos(prop) {
    const resultados = {};

    // Fotos (mínimo 5)
    try {
        const { data: fotos } = await sb.from('fotos')
            .select('id', { count: 'exact' })
            .eq('prop_id', prop.id)
            .eq('destaque', true);
        resultados.fotos = (fotos?.length || 0) >= 5;
    } catch (_) { resultados.fotos = false; }

    // Sobre (descrição)
    try {
        const { data } = await sb.from('propriedades')
            .select('descricao')
            .eq('id', prop.id)
            .single();
        resultados.descricao = !!(data?.descricao && data.descricao.trim().length > 20);
    } catch (_) { resultados.descricao = false; }

    // Endereço
    try {
        const { data } = await sb.from('enderecos')
            .select('cep,rua,numero,bairro,cidade,estado')
            .eq('prop_id', prop.id)
            .single();
        resultados.endereco = !!(data?.cep && data?.cidade);
    } catch (_) { resultados.endereco = false; }

    // Contato
    try {
        const { data } = await sb.from('contatos')
            .select('whatsapp,email')
            .eq('prop_id', prop.id)
            .single();
        resultados.contato = !!(data?.whatsapp || data?.email);
    } catch (_) { resultados.contato = false; }

    // Valores
    try {
        const { data } = await sb.from('valores')
            .select('valor_hora,valor_diaria')
            .eq('prop_id', prop.id)
            .single();
        resultados.valores = !!(data?.valor_hora || data?.valor_diaria);
    } catch (_) { resultados.valores = false; }

    // Tipos de evento
    try {
        const { data } = await sb.from('tipos_evento')
            .select('id', { count: 'exact' })
            .eq('prop_id', prop.id);
        resultados.eventos = (data?.length || 0) >= 1;
    } catch (_) { resultados.eventos = false; }

    return resultados;
}

// ── Solicitação de publicação ─────────────
export async function solicitarPublicacao(userId) {
    await sb.from('solicitacoes_publicacao').upsert(
        { user_id: userId, status: 'pendente', criado_em: new Date().toISOString() },
        { onConflict: 'user_id' }
    );
}
