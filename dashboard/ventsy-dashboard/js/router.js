// ─────────────────────────────────────────
//  VENTSY — Router (hash-based SPA)
//
//  URLs:  /dashboard/index.html#dashboard
//         /dashboard/index.html#financeiro
//         /dashboard/index.html#documentos
//         /dashboard/index.html#equipe
// ─────────────────────────────────────────
import { ROUTES } from './config.js';
import { closeSidebar } from './ui.js';
import { marcarModuloIniciado, moduloJaIniciado } from './state.js';

// Mapa de callbacks de inicialização de módulos
// Cada módulo registra aqui sua função de boot
const moduleInits = {};

export function registrarModulo(rota, initFn) {
    moduleInits[rota] = initFn;
}

// Navega para uma rota e atualiza a URL
export function navegar(rota, pushState = true) {
    const rotaValida = ROUTES.includes(rota) ? rota : 'dashboard';

    // Atualiza hash na URL
    if (pushState) {
        history.pushState({ rota: rotaValida }, '', '#' + rotaValida);
    } else {
        history.replaceState({ rota: rotaValida }, '', '#' + rotaValida);
    }

    _mostrarPagina(rotaValida);
}

// Lê o hash atual e navega para ele (chamado no init)
export function rotaInicial() {
    const hash = location.hash.replace('#', '');
    const rota = ROUTES.includes(hash) ? hash : 'dashboard';
    navegar(rota, false);
}

// ── Listener de botão voltar/avançar ─────
window.addEventListener('popstate', e => {
    const rota = e.state?.rota || 'dashboard';
    _mostrarPagina(rota);
});

// ── Troca de seção visível ────────────────
function _mostrarPagina(rota) {
    // Mostra/oculta seções
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('ativa'));
    const secao = document.getElementById('pagina-' + rota);
    if (secao) secao.classList.add('ativa');

    // Atualiza menu ativo
    document.querySelectorAll('.dash-menu a[data-rota]').forEach(a => {
        a.classList.toggle('active', a.dataset.rota === rota);
    });

    // Fecha sidebar no mobile
    closeSidebar();

    // Inicializa módulo lazy (só na primeira vez)
    if (!moduloJaIniciado(rota) && moduleInits[rota]) {
        marcarModuloIniciado(rota);
        setTimeout(() => moduleInits[rota](), 50);
    }
}
