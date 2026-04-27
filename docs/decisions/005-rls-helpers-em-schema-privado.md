# ADR 005 — Helpers privilegiados de RLS em schema privado

**Status**: Aceita
**Data**: 2026-04-27

## Contexto

O Veda Bene já usa funções `SECURITY DEFINER` para destravar policies RLS que
precisam consultar tabelas protegidas por outras policies:

- `client_property_ids(uid)` para mapear o cliente aos seus imóveis
- `staff_property_ids(uid)` para mapear limpeza/consegna aos imóveis das suas OSs

Essa abordagem continua válida, mas a implementação original deixava ambos os
helpers no schema `public`, que é exposto por padrão pela Data API do Supabase.
Mesmo quando a policy passa `auth.uid()`, isso amplia a superfície de execução
de funções privilegiadas e gera finding de segurança.

## Decisão

Os helpers privilegiados usados apenas por policies RLS devem viver em um
schema privado, não exposto na API:

- os helpers foram movidos para o schema `private`
- as policies chamam explicitamente `private.client_property_ids(...)` e
  `private.staff_property_ids(...)`
- as funções usam `SET search_path = ''` e referenciam tabelas por nome
  totalmente qualificado
- o schema `private` concede `USAGE` apenas a `authenticated`
- `EXECUTE` é concedido explicitamente apenas nas duas funções necessárias
- os entrypoints antigos em `public` são removidos

Esta decisão complementa a ADR 003: o modelo de identificação por email-match
permanece o mesmo; muda apenas o enclausuramento operacional dos helpers
privilegiados.

## Consequências

**Positivas**:
- reduz a superfície exposta pela Data API do Supabase
- elimina a possibilidade de invocação direta desses helpers via `public`
- mantém o comportamento atual das policies sem reintroduzir joins recursivos

**Negativas**:
- aumenta a complexidade operacional das migrations de RLS
- novas policies que dependam de helper privilegiado agora precisam lembrar de
  criar a função em schema privado e qualificar a chamada
- grants em schema/função passam a fazer parte obrigatória do checklist de
  revisão

## Alternativas consideradas

- **Manter os helpers em `public` e apenas revogar `EXECUTE`**: reduz parte do
  risco, mas continua contrariando a recomendação do Supabase para
  `SECURITY DEFINER` em schema exposto.
- **Voltar ao join inline nas policies**: descartado porque já causou bug real
  de acesso vazio para `cliente` e risco de recursão/performance.
- **Trocar para helpers sem parâmetro**: não resolve o problema principal de
  exposição do schema e aumentaria o escopo da refatoração sem benefício
  proporcional.
