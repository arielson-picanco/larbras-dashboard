# LARBRAS — Painel de Vendas

Dashboard moderno de análise de vendas para produtos de móveis e eletrodomésticos.

---

## Stack

| Camada          | Tecnologia          | Motivo                                              |
|-----------------|---------------------|-----------------------------------------------------|
| UI Framework    | React 18 + Vite 5   | Componentes, HMR, build rápido                      |
| Tipagem         | TypeScript 5        | Contratos de dados, erros em compile-time           |
| Estado          | Zustand             | Substitui ALL_ROWS/ROWS/D/WB_STATE/CURRENT_PERIOD   |
| Gráficos        | Recharts            | Lifecycle React nativo, sem killAll()               |
| Estilo          | Tailwind CSS        | Utilitários, dark/light mode com `.dark` class      |
| Persistência    | IndexedDB           | Dados sobrevivem ao fechar o navegador              |
| Exportação      | jsPDF + SheetJS     | PDF e XLSX nativos no browser                       |
| Testes          | Vitest              | Unitários para analytics, filters, parser           |

---

## Estrutura de módulos

```
src/
├── types/          # MÓDULO 1 — Contratos TypeScript (SaleRow, FilterState, etc.)
├── store/          # MÓDULO 1 — Zustand store (estado centralizado)
├── services/
│   ├── analytics.ts  # MÓDULO 2 — buildDerived, KPI metrics, formatters
│   ├── filters.ts    # MÓDULO 2 — applyFilters, countActiveFilters
│   ├── parser.ts     # MÓDULO 2 — XLSX/CSV parsing, auto-detect colunas
│   ├── db.ts         # MÓDULO 2 — IndexedDB (persistência de dados)
│   ├── api.ts        # MÓDULO 2 — Abstração API (local ↔ backend)
│   ├── export.ts     # MÓDULO 6 — PDF e Excel export
│   └── __tests__/    # MÓDULO 7 — Testes Vitest
├── components/
│   ├── layout/       # MÓDULO 3 — Header, TabNav
│   ├── filters/      # MÓDULO 3 — FilterBar + DateRangePicker
│   ├── kpi/          # MÓDULO 4 — KPICard, KPISection
│   ├── charts/       # MÓDULO 4 — RevenueChart, ProductChart, SellerChart, etc.
│   ├── table/        # MÓDULO 5 — DataTable paginada com ordenação
│   ├── import/       # MÓDULO 3 — ImportModal (drag-drop + CSV paste)
│   └── export/       # MÓDULO 6 — ExportButton (PDF/XLSX)
├── pages/            # MÓDULO 5 — OverviewPage, ProductsPage, SellersPage, etc.
├── App.tsx
├── main.tsx
└── index.css         # MÓDULO 1 — Design tokens (CSS variables)
```

---

## Instalação e uso

```bash
# 1. Instalar dependências
npm install

# 2. Rodar em desenvolvimento
npm run dev

# 3. Executar testes
npm test

# 4. Build de produção
npm run build
```

---

## Formato de dados esperado

O sistema aceita qualquer arquivo XLSX/CSV. A detecção de colunas é automática via sinônimos. Exemplos de nomes reconhecidos:

| Campo interno | Nomes aceitos na planilha                                                     |
|---------------|-------------------------------------------------------------------------------|
| Data          | data, date, datavenda, datapedido, dtvenda                                    |
| Valor         | totalmercadoria, totalvenda, faturamento, receita, valor, total, preco, price |
| Cliente       | cliente, nome, razao, razaosocial, nomecliente, customer                      |
| Produto       | produto, model, modelo, item, descricao, description, nomeproduto             |
| Marca         | marca, brand, fabricante, fornecedor                                          |
| Vendedor      | vendedor, consultor, atendente, operador, responsavel, seller                 |
| Localidade    | bairro, localidade, regiao, zona, cidade, municipio                           |
| Quantidade    | qtd, quantidade, quantity, qty, volume, unidades                              |

---

## Migração para API backend (VITE_USE_API)

Para conectar a um backend REST, crie `.env.local`:

```env
VITE_USE_API=true
VITE_API_URL=https://seu-backend.com/api
```

O serviço `src/services/api.ts` redireciona automaticamente as chamadas para o backend. Endpoints esperados:

```
GET  /api/sales               → SaleRow[]
POST /api/sales/query         → Paginated<SaleRow>
POST /api/sales/upload        → SaleRow[]  (multipart/form-data)
```

---

## Funcionalidades

- **Importação** — XLSX, XLS e CSV; drag-drop ou paste; detecção automática de colunas
- **Persistência** — IndexedDB salva os dados entre sessões
- **Filtros** — Período fixo (7/30/90/180d), date range picker, vendedor, produto, marca, localidade, busca full-text
- **Dashboards** — Visão Geral, Produtos, Vendedores, Clientes, Dados Detalhados
- **Gráficos** — Área (receita temporal), barras horizontais (produtos), barras verticais (vendedores), donut (marcas), barras de progresso (localidades)
- **Tabela** — Paginação (25/50/100/200 linhas), ordenação por qualquer coluna
- **Exportação** — PDF com KPIs e tabela, XLSX com 5 abas (dados, KPIs, por produto, por vendedor, top clientes)
- **Tema** — Dark/Light com transição suave, persistido em localStorage
- **Testes** — 20+ testes unitários cobrindo analytics, filters e parser

---

## Melhorias planejadas (v2)

- [ ] URL state para filtros (query params compartilháveis)
- [ ] Web Worker para parsing de arquivos grandes
- [ ] Comparação de dois períodos lado a lado
- [ ] Metas configuráveis com alertas visuais
- [ ] Modo apresentação (kiosk) sem header/filtros
- [ ] Autenticação para modo multi-usuário
