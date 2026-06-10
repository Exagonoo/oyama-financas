# OYAMA Finanças — Pronto para implementar

## Status atual
- ✅ Lovable Cloud habilitado
- ✅ Migration aplicada exatamente como enviada (5 tabelas, view `account_balances`, trigger `on_auth_user_created`, RLS por usuário, GRANTs)
- ✅ Auth configurado com auto-confirm de e-mail (cadastro entra direto)

## O que vou construir agora

**Fundação**
- Tema **dark por padrão** com primária verde (`#16a34a` / oklch equivalente), tokens semânticos em `src/styles.css`, estrutura preparada para light futuro.
- `src/lib/format.ts` — BRL, datas dd/MM/yyyy, helpers de mês.
- `src/lib/queries.ts` — `queryOptions` por entidade (accounts, balances, categories, transactions do mês / recentes / pendentes, budgets, range).
- `src/lib/account-types.ts` — rótulos pt-BR e paletas de cor/ícone.

**Identidade**
- `<Logo />` componentizado (wordmark "OYAMA" + "Finanças") — fácil trocar por imagem depois.
- Rodapé global "© 2026 OYAMA Soluções Digitais. Todos os direitos reservados."

**Auth**
- `/auth` — login + cadastro em abas, wordmark centralizado, tagline "Suas finanças, com clareza.", rodapé OYAMA.
- `_authenticated/route.tsx` — gate `ssr:false` redirecionando para `/auth`.
- `__root.tsx` — `<html class="dark">`, QueryClient, `onAuthStateChange` que invalida queries em SIGNED_IN/OUT/USER_UPDATED, Toaster (sonner), `<title>OYAMA Finanças</title>`.

**AppShell**
- Desktop (≥ md): sidebar fixa com logo, navegação completa, avatar + logout no rodapé.
- Mobile: header com logo + bottom nav com 5 ícones (Início, Lançamentos, Contas, Orçamentos, Relatórios); Categorias acessível via header.
- Layout `flex w-full min-h-screen` com `<Outlet />`.

**Componentes compartilhados**
- `MonthPicker` controlado por search param `?mes=YYYY-MM`.
- `TransactionForm` (Sheet) — tipo, descrição, valor, data, conta, categoria (oculta em transferência, mostra "conta destino"), status.
- `CategoryIcon` (resolve ícone lucide a partir do nome).
- `EmptyState`.

**Páginas autenticadas**
- `/` Dashboard — saldo geral, cards receitas/despesas/balanço, indicador de pendências, "Contas a pagar" com efetivar rápido (destaque vermelho vencidas, amarelo ≤7 dias), donut de despesas por categoria (recharts), 5 lançamentos recentes, `MonthPicker`.
- `/lancamentos` — lista do mês agrupada por dia, filtros (tipo/conta/status), FAB `+`, editar/excluir/efetivar.
- `/contas` — cards com saldo da view; criar/editar (nome, tipo, saldo inicial, cor); arquivar quando há lançamentos.
- `/categorias` — abas Despesas/Receitas; CRUD com seletor de cor e ícone lucide.
- `/orcamentos` — limite mensal por categoria de despesa; barra de progresso (amarelo ≥80%, vermelho >100%).
- `/relatorios` — barras receitas vs despesas (6 meses), linha de evolução do saldo, ranking de categorias.

**Regras de negócio**
- Valores positivos no banco; sinal/cor por tipo.
- Transferências não entram em totais de receita/despesa.
- Apenas `completed` afeta saldos/gráficos.
- Formatação BR.

Vou rodar tudo em sequência sem mais perguntas. Clique em **Implement plan** abaixo para eu começar.
