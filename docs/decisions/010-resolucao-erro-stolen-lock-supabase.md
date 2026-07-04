# ADR 010 — Resolução de Erro de Concorrência de Autenticação (Lock Stolen)

**Status**: Aceita
**Data**: 2026-07-04

## Contexto

A aplicação Veda Bene utiliza o Supabase Auth com o pacote `@supabase/ssr` e `@supabase/supabase-js` para gerenciamento de sessão, autenticação e autorização por papéis baseada em JWT (Role-Based Access Control - RBAC).

### O Problema
No ambiente de produção, o Sentry capturou o erro crítico `AbortError: Lock was stolen by another request` (`JAVASCRIPT-NEXTJS-D`) no lado do cliente (client-side), com maior incidência na rota `/service-orders` acessada a partir de dispositivos móveis.

A investigação técnica revelou o seguinte comportamento:
1. **Web Locks API (`navigator.locks`):** Nas versões do SDK do Supabase anteriores à `2.107.0`, o cliente de autenticação gerenciava a persistência e atualização paralela da sessão utilizando a API experimental de bloqueios do navegador (`navigator.locks`).
2. **Criação de Clientes Paralelos:** Hooks de controle client-side (como o `useRole.ts`) e o ciclo de vida de renderização do Next.js instanciam múltiplos clientes Supabase no navegador por meio da função `createClient()` do helper de client-side.
3. **Roubo de Locks:** Quando diferentes componentes ou abas concorrentes tentavam acessar/atualizar a sessão simultaneamente, um cliente solicitava o bloqueio com a opção de roubo (`{ steal: true }`). O navegador cancelava a requisição anterior, disparando um `AbortError` não tratado que borbulhava até o console e era interceptado pelo Sentry como falha crítica de execução.
4. **Ciclo Mobile:** Esse comportamento era exacerbado em dispositivos móveis, cuja suspensão agressiva de abas e reinicialização rápida causavam conflitos diretos de concorrência de sessão.

---

## Decisão

Adotamos a **Solução A**: atualizar o SDK `@supabase/supabase-js` de sua versão original `^2.102.1` para a versão **`^2.107.0`**.

A partir da versão `2.107.0`, a equipe de engenharia do Supabase removeu inteiramente o uso do `navigator.locks` como mutex interno de controle de sessão, substituindo-o por um mecanismo simplificado de máquina de estados de sincronização chamado "commit guard". Com essa alteração, a concorrência entre instâncias do cliente Supabase e abas do navegador é resolvida nativamente sem disparar exceções de cancelamento de Promise e sem travar o estado do cliente.

---

## Consequências

### Positivas
- **Resolução Definitiva na Raiz:** O problema foi sanado no próprio núcleo do SDK do Supabase, sem necessidade de implementar soluções de contorno temporárias ou customizações frágeis no nosso helper de inicialização.
- **Redução de Ruído no Sentry:** Eliminação completa dos alertas de `AbortError: Lock was stolen` no console de produção.
- **Maior Resiliência Mobile e de Abas:** Usuários que acessam o sistema via celulares ou mantêm múltiplas abas abertas não experimentarão mais travamentos em telas de carregamento ou deslogamentos abruptos de sessão.
- **Manutenibilidade:** Mantivemos o código limpo, sem workarounds complexos.

### Negativas / Tradeoffs
- **Dependência de Atualização de Pacote:** Qualquer atualização de dependência de terceiros carrega um risco inerente de regressões. Entretanto, este risco foi mitigado através de validações rígidas de build e execução de toda a suíte de testes unitários e de integração do projeto.

---

## Alternativas Consideradas

### Manter a versão atual e desativar locks manualmente (Workaround)
Poderíamos passar uma função de bloqueio customizada nula ("no-op") na inicialização do cliente Supabase client-side:
```typescript
auth: {
  lock: async (name, acquireTimeout, fn) => await fn(),
}
```
*Motivo do Descarte:* Embora essa solução evitasse o erro, ela desativaria completamente a proteção contra race conditions genuínas de sessões paralelas. Além disso, introduziria uma configuração não padrão ("no-op lock") que futuros desenvolvedores precisariam compreender e manter. A atualização nativa do SDK é uma abordagem mais limpa e recomendada pelo próprio time do Supabase.

---

## Referências

- [package.json](../../package.json)
- [utils/supabase/client.ts](../../utils/supabase/client.ts)
- [useRole.ts](../../lib/hooks/useRole.ts)
- [Issue original no GitHub do Supabase - navigator.locks deadlock](https://github.com/supabase/supabase-js/issues)
