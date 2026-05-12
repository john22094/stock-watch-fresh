
# Mapa 2D Inteligente — Plano de Entrega

A imagem enviada define o alvo visual: dashboard escuro, setores coloridos (A/B/C/D), prateleiras com código + produto + unidades + barra de %, recepção/expedição, área de paletes, legenda, info gerais, mini mapa e barra inferior de ferramentas (Selecionar, Mover, Adicionar Prateleira/Corredor/Setor, Excluir, Editar, Salvar, Cancelar, Histórico).

O escopo total pedido (editor WMS completo + sincronização realtime + auditoria detalhada + import/export + multi-seleção + undo/redo + bloqueio + backup) é grande demais para uma única entrega estável. Proponho **4 fases**, cada uma testável e útil sozinha. Você aprova esta fase 1 e seguimos.

---

## Fase 1 — Visual + Editor base + Sincronização (esta entrega)

### Visual (igual à imagem)
- Cabeçalho escuro: título "MAPA 2D DO ESTOQUE", subtítulo, toggle **Visualização / Edição**, controles de **zoom (- % +)** e **tela cheia**
- Canvas central com fundo de piso industrial, setas de fluxo, **setores coloridos** agrupando prateleiras
- Prateleiras renderizadas como blocos com: **código**, **produto**, **unidades**, **barra de ocupação %** colorida por nível
- **Recepção** (esquerda-topo) e **Saída/Expedição** (esquerda-base) com ícone de caminhão
- **Área de Paletes** central inferior
- Painel direito: **Legenda**, **Informações Gerais** (prateleiras, capacidade total, ocupação atual, taxa %), **Mini Mapa** com retângulo de viewport
- Barra inferior (apenas em Modo Edição): Selecionar, Mover, Adicionar Prateleira, Adicionar Corredor, Adicionar Setor, Excluir, Editar, **Salvar**, Cancelar, Histórico

### Editor base
- Drag-and-drop de **prateleiras** e **setores** com snap to grid (20px)
- Criar / renomear / mudar cor / excluir prateleiras e setores
- Mover **Recepção** e **Expedição** (entrada/saída) pelo mapa
- Redimensionar setores
- Botões: **Salvar**, **Cancelar** (descarta), **Resetar Mapa** (PIN 0912, zera posições sem apagar estoque), **Atualizar Mapa** (refetch)
- Permissões: Gerente edita tudo, Encarregado move; Repositor/RH só visualizam

### Sincronização com Estoque
- Cores da prateleira calculadas em tempo real:
  - 0% cinza (vazio) · 1–60% verde · 61–85% amarelo · 86–100% vermelho
- Supabase Realtime em `estoque`, `prateleiras`, `setores`, `paletes`
- Quantidade e % atualizam sozinhas quando estoque muda

### Monitoramento ao vivo detalhado
Atualizar `LiveMonitor` para mostrar, por evento:
- Nome + matrícula + cargo do funcionário
- Ação ("Moveu 50un de Coca-Cola da A01 → A02")
- Produto, quantidade, prateleira origem/destino
- Data/hora completa
- Ícone colorido por tipo (mover, adicionar, remover, editar layout, reset)
- Filtros por funcionário, tipo, período

### Banco
Adicionar colunas que faltam em `prateleiras`/`setores` se necessário e tabela `mapa_layout` (singleton por empresa) para guardar posições de Recepção/Expedição/Área de Paletes.

---

## Fase 2 — Paletes + Corredores + Multi-seleção
- Drag-and-drop de paletes individuais
- Criar/mover/excluir corredores como elemento próprio
- Seleção múltipla (Shift+click, marquee), mover em grupo
- Duplicar elementos (Ctrl+D)
- Bloquear/desbloquear elementos

## Fase 3 — Undo/Redo + Histórico + Auditoria
- Pilha undo/redo (Ctrl+Z / Ctrl+Y) durante edição
- Painel **Histórico** com snapshots de layout (rollback)
- Auditoria completa com filtros e busca textual

## Fase 4 — Import/Export + Backup + Polimento
- Exportar layout em JSON e PNG
- Importar layout JSON
- Backup automático diário
- Alinhamento inteligente (guides), animações refinadas, performance (memo + virtualização)

---

## Detalhes técnicos (Fase 1)

**Arquivos:**
- `src/pages/MapaPage.tsx` — reescrita completa com novo layout
- `src/components/mapa/MapaCanvas.tsx` — canvas SVG com pan/zoom
- `src/components/mapa/MapaToolbar.tsx` — barra inferior de ferramentas
- `src/components/mapa/MapaSidebar.tsx` — legenda + info gerais + mini mapa
- `src/components/mapa/PrateleiraNode.tsx`, `SetorNode.tsx`, `ZonaNode.tsx` (recepção/expedição/paletes)
- `src/components/LiveMonitor.tsx` — versão detalhada
- `src/hooks/useMapaLayout.ts` — fetch + realtime + mutations

**Migração:**
- Tabela `mapa_layout` (empresa_id, recepcao_x/y, expedicao_x/y, area_paletes_x/y/largura/altura)
- RLS: membros veem; gerente/encarregado editam

**Stack:** SVG nativo + drag manual (evita libs pesadas), Framer Motion para transições, TanStack Query, Supabase Realtime.

---

Confirma a **Fase 1** para eu começar agora? Se quiser ajustar escopo (ex: trazer paletes-DnD ou undo/redo já pra Fase 1), me diga antes.
