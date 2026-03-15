-- ============================================================
-- Tabela: clientes_eventos
-- Criada para o módulo "Clientes & Eventos" do dashboard VENTSY
-- Execute no Supabase: Database > SQL Editor
-- ============================================================

create table if not exists public.clientes_eventos (
    id                    uuid primary key default gen_random_uuid(),
    propriedade_id        uuid not null references public.propriedades(id) on delete cascade,
    usuario_id            uuid not null references auth.users(id) on delete cascade,

    -- Funil / Status
    status                text not null default 'lead',
    -- Valores válidos: lead, consultada, visita, negociacao, reserva,
    --                  contrato, briefing, pronto, montagem,
    --                  concluido, pos_evento, perdido, recontactar

    -- Dados Pessoais
    nome_evento           text,
    nome_pessoa           text,
    tipo_documento        text,           -- 'cpf' ou 'cnpj'
    documento             text,
    telefones             text,           -- JSON array serializado: ["(11) 99999-0000", ...]
    email                 text,
    contato_emergencia    text,
    como_conheceu         text,

    -- Dados do Evento
    tipo_evento           text,
    data_inicio           date,
    data_fim              date,
    horario_inicio        text,
    horario_fim           text,
    nomes_principais      text,
    qtd_adultos           integer,
    qtd_criancas          integer,

    -- Logística
    formato_recepcao      text,           -- JSON array: ["Coquetel","Churrasco"]
    layout_mesas_url      text,
    horario_montagem      text,
    horario_desmontagem   text,
    checkin_materiais     text,

    -- Serviços & Estrutura
    servicos_contratados  text,           -- JSON array: ["Som","Iluminação"]
    fornecedores_externos text,
    necessidades_tecnicas text,

    -- Financeiro
    valor_total           numeric(12,2),
    forma_pagamento       text,           -- JSON array: ["Pix","Cartão"]
    datas_vencimento      text,
    taxas_extras          text,

    -- Experiências
    restricoes_alimentares text,
    lista_vip             text,
    observacoes           text,

    -- Checklist (JSON object com itens boolean)
    checklist             jsonb default '{}'::jsonb,

    -- Timestamps
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

-- Índices para consultas frequentes
create index if not exists idx_clientes_eventos_prop  on public.clientes_eventos(propriedade_id);
create index if not exists idx_clientes_eventos_user  on public.clientes_eventos(usuario_id);
create index if not exists idx_clientes_eventos_data  on public.clientes_eventos(data_inicio);
create index if not exists idx_clientes_eventos_status on public.clientes_eventos(status);

-- Trigger para atualizar updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_clientes_eventos_updated_at on public.clientes_eventos;
create trigger trg_clientes_eventos_updated_at
    before update on public.clientes_eventos
    for each row execute function public.set_updated_at();

-- RLS (Row Level Security)
alter table public.clientes_eventos enable row level security;

-- Usuário só vê/edita seus próprios registros
create policy "usuarios_veem_seus_eventos"
    on public.clientes_eventos for select
    using (auth.uid() = usuario_id);

create policy "usuarios_inserem_seus_eventos"
    on public.clientes_eventos for insert
    with check (auth.uid() = usuario_id);

create policy "usuarios_atualizam_seus_eventos"
    on public.clientes_eventos for update
    using (auth.uid() = usuario_id);

create policy "usuarios_deletam_seus_eventos"
    on public.clientes_eventos for delete
    using (auth.uid() = usuario_id);
