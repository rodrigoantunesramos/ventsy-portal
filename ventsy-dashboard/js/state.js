// ─────────────────────────────────────────
//  VENTSY — Estado global da aplicação
// ─────────────────────────────────────────

export const state = {
    // Usuário autenticado
    user: null,
    perfil: null,
    assinatura: null,

    // Propriedade ativa
    propId: null,
    propNome: null,
    propSlug: null,

    // Controle de módulos já inicializados (lazy load)
    modulosIniciados: new Set(),

    // Controle de passos concluídos
    passosCompletos: new Set(),
};

// Helpers para atualizar state sem substituir referência
export function setState(partial) {
    Object.assign(state, partial);
}

export function marcarModuloIniciado(nome) {
    state.modulosIniciados.add(nome);
}

export function moduloJaIniciado(nome) {
    return state.modulosIniciados.has(nome);
}
