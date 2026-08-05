# Consistência entre CSV e PDF do extrato A Pagar

**Data**: 2026-08-04

**Estado**: implementado e validado localmente; não commitado nem implantado

**Commit**: não disponível

## Resumo

Esta manutenção alinhou a exportação CSV do módulo **A Pagar** ao detalhamento
por Ordem de Trabalho já utilizado pelo PDF. Antes da correção, o PDF consumia
linhas detalhadas por ordem, enquanto o CSV recebia somente o resumo agregado
por funcionário. Os dois formatos podiam, portanto, apresentar estruturas
diferentes para o mesmo filtro.

O CSV passou a consumir a mesma fonte canônica do PDF,
`getPayableDetailRows`, sem alterar consultas financeiras, fórmulas de
remuneração, rateio de horas ou dados persistidos. Os termos do extrato A Pagar
também foram padronizados em italiano nos dois formatos.

Esta correção preserva a arquitetura de relatórios consolidada na
[Etapa 6](../evolution/stage-06-reporting-exports.md). Não foi criado um novo
ADR porque a mudança corrige a apresentação de uma exportação sem estabelecer
uma nova decisão arquitetural.

## Problema e causa raiz

A rota `GET /api/export/payable` carregava `getPayableStatementRows`, produtor
do resumo exibido na tela com uma linha por funcionário. O PDF, por sua vez,
carregava `getPayableDetailRows`, produtor com uma linha por funcionário e por
Ordem de Trabalho.

Como consequência, o CSV não incluía data, número da ordem, imóvel e total por
ordem, embora esses dados já estivessem disponíveis no PDF do mesmo filtro. A
causa não estava no banco nem nos cálculos: era a escolha de produtores
canônicos diferentes nos dois adaptadores de exportação.

## Decisão de implementação

Os seguintes contratos devem ser preservados em futuras manutenções:

1. PDF e CSV do extrato A Pagar devem receber linhas de
   `getPayableDetailRows`; nenhum formatador deve consultar o banco ou recalcular
   remuneração de forma independente.
2. O CSV permanece tabular: repete o funcionário em cada linha e mantém uma
   linha por combinação funcionário/Ordem de Trabalho. O PDF pode agrupar essas
   mesmas linhas visualmente por funcionário.
3. A ordem das informações transacionais é: data da O.L., número da O.L.,
   imóvel, horas a pagar, tarifa horária e total por O.L. O CSV adiciona
   `Dipendente` como primeira coluna para conservar a identificação no formato
   tabular.
4. Datas provenientes de `completed_at` devem ser formatadas explicitamente em
   `Europe/Rome`, conforme o [ADR 013](../decisions/013-padronizacao-fuso-horario-rome-timestamps.md).
5. O rateio de horas entre múltiplos funcionários continua pertencendo ao
   produtor canônico, conforme o
   [ADR 009](../decisions/009-multiplos-funcionarios-limpeza-na-os.md). Os
   formatadores apenas apresentam `hours`, `hourly_rate` e `os_total` recebidos.

## Contrato de apresentação

O cabeçalho do CSV passou a ser:

```text
Dipendente,Data O.L.,Numero O.L.,Immobile/i,Ore da pagare (h),Tariffa oraria (€),Totale per O.L. (€)
```

Regras complementares:

- horas e valores usam duas casas decimais;
- valores financeiros não aplicáveis são apresentados como `-`;
- o número da ordem permanece um valor tabular, sem recalcular ou transformar o
  identificador;
- o arquivo é nomeado como
  `estratto-da-pagare_<data-inicial>_<data-final>.csv`;
- o PDF usa, entre outros, os rótulos `Estratto da pagare`, `Dipendente`,
  `Periodo`, `Ore da pagare`, `Tariffa oraria`, `Totale per O.L.` e
  `Totale ore da pagare`;
- o botão da janela de impressão é apresentado como `Stampa / Salva PDF`.

## Arquivos alterados

- [`app/api/export/payable/route.ts`](../../app/api/export/payable/route.ts): a
  rota passou a carregar o detalhe canônico e adotou o nome de arquivo em
  italiano.
- [`lib/utils/export-csv.ts`](../../lib/utils/export-csv.ts): o formatador
  passou de resumo por funcionário para linhas detalhadas por ordem, com datas
  em Roma e rótulos italianos.
- [`lib/utils/export-pdf.ts`](../../lib/utils/export-pdf.ts): os termos do
  extrato A Pagar foram traduzidos e a construção do corpo foi isolada em
  `buildPayablePrintBody` para permitir teste sem abrir uma janela.
- [`app/api/export/payable/route.test.ts`](../../app/api/export/payable/route.test.ts):
  cobre autenticação, autorização e uso do detalhe canônico na rota.
- [`lib/utils/export-csv.test.ts`](../../lib/utils/export-csv.test.ts): cobre
  colunas, idioma, timezone, casas decimais e neutralização de fórmulas.
- [`lib/utils/export-pdf.test.ts`](../../lib/utils/export-pdf.test.ts): cobre a
  estrutura detalhada, os rótulos italianos e o escape de HTML.

## Invariantes de segurança preservados

- a rota continua exigindo sessão autenticada e perfil `admin` no servidor;
- filtros de período e funcionário continuam validados por
  `payableExportSearchParamsSchema` antes da consulta;
- o CSV continua neutralizando células iniciadas por `=`, `+`, `-` ou `@` para
  impedir execução de fórmulas ao abrir o arquivo em uma planilha;
- valores dinâmicos do PDF continuam escapados antes de serem escritos no HTML;
- nenhuma credencial, política RLS, permissão, schema, migration ou dado de
  produção foi alterado.

## Validação executada

No estado local da implementação:

- `npm test`: 25 arquivos e 108 testes aprovados;
- `npm run typecheck`: aprovado;
- `npm run build`: aprovado com Next.js `16.2.12`;
- ESLint direcionado aos seis arquivos de implementação/teste: aprovado;
- `git diff --check`: aprovado.

O comando global `npm run lint` foi bloqueado exclusivamente pelo arquivo não
rastreado e preexistente `deep_investigation.cjs`, que usa `require()` e não faz
parte desta manutenção. Esse arquivo não foi modificado.

## Implantação, rollback e manutenção futura

- A mudança ainda precisa ser commitada, publicada e validada em uma sessão
  administrativa real antes de ser marcada como implantada.
- A validação manual recomendada deve comparar PDF e CSV gerados com o mesmo
  período e o mesmo funcionário, incluindo: múltiplos funcionários na mesma
  ordem, funcionário sem tarifa horária e funcionário com salário fixo.
- O rollback é somente de aplicação: reimplantar a versão anterior ou reverter
  os formatadores e a rota. Não há migration nem operação de banco a desfazer.
- Ao adicionar colunas financeiras ao extrato A Pagar, primeiro estender o tipo
  `PayableDetailRow` e o produtor canônico; depois adaptar PDF, CSV e seus testes
  no mesmo conjunto de mudanças.
- Não mover cálculos para `export-csv.ts` ou `export-pdf.ts`. Esses módulos devem
  permanecer formatadores puros para evitar divergência futura entre tela,
  exportações e dashboard.

## Riscos residuais

- Ainda não foi executada uma comparação visual autenticada dos arquivos
  baixados/abertos em navegador real após esta alteração.
- O CSV é deliberadamente tabular e repete o funcionário em cada linha; o PDF
  agrupa visualmente as mesmas linhas e apresenta subtotais. Uma futura exigência
  de subtotais também no CSV deve definir se eles serão novas colunas ou linhas
  de resumo, evitando misturar os dois modelos sem decisão explícita.
