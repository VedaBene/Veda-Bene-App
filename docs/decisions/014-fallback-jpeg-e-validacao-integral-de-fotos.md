# ADR 014 — Fallback JPEG e validação integral das fotos de limpeza

**Status**: Aceita; supersede parcialmente o ADR 012
**Data**: 2026-07-30

## Contexto

O ADR 012 exigia que todo navegador codificasse as duas variantes em WebP. Em
alguns navegadores móveis, especialmente WebViews/iOS, a leitura de WebP pode
existir sem que `canvas.toBlob()` consiga codificá-lo de forma confiável. A API
pode devolver `null` ou outro MIME, impedindo o início/conclusão da limpeza.

A inspeção final também reconhecia apenas o cabeçalho WebP. Isso não comprovava
que o arquivo inteiro era decodificável.

## Decisão

- Negociar a codificação no cliente: usar WebP quando um probe real de canvas
  confirmar o MIME retornado e usar JPEG como fallback.
- Gerar `display` e `thumbnail` sequencialmente, com o mesmo MIME, limites de
  tamanho e caminhos imutáveis `.webp` ou `.jpg`.
- Registrar o MIME contratado em `service_order_photos.content_type`, mantendo
  `image/webp` como default compatível para registros e aplicações anteriores.
- Ampliar o bucket privado somente para `image/webp` e `image/jpeg`.
- Na finalização, conferir caminho, metadados do Storage, MIME, tamanho,
  dimensões, formato decodificado e decodificação integral com limite de pixels.
- Registrar no Sentry falhas técnicas por etapa e código, sem nome, bytes ou
  conteúdo da foto.
- Limitar a fonte a 50 megapixels antes de criar canvases de saída.

As decisões do ADR 012 sobre privacidade, RLS, URLs assinadas, ciclos, estados
`pending`/`ready`, autorização e rollback não destrutivo permanecem vigentes.

## Consequências

**Positivas**:

- Navegadores sem encoder WebP funcional continuam o fluxo por JPEG.
- O contrato entre cliente, banco e Storage passa a refletir o MIME real.
- Arquivos truncados ou fabricados não se tornam `ready` apenas por um cabeçalho
  plausível.
- O processamento sequencial e o limite de pixels reduzem picos de memória.

**Negativas**:

- JPEG pode produzir arquivos maiores ou perder transparência; fotos de limpeza
  são renderizadas sobre canvas opaco e continuam sujeitas aos mesmos limites.
- A finalização faz uma decodificação completa dos dois arquivos e consome mais
  CPU no servidor.
- A aplicação nova depende da migração aditiva que registra e libera JPEG.

## Alternativas consideradas

- **Continuar exigindo WebP**: rejeitada porque mantém o bloqueio em dispositivos
  cujo canvas não fornece um encoder funcional.
- **Enviar o original**: rejeitada por preservar metadados, variar formatos e
  aumentar o risco e o consumo de armazenamento.
- **Converter tudo no servidor**: adiada porque exigiria enviar originais maiores
  e mudaria o fluxo de upload assinado; poderá ser reavaliada se o fallback ainda
  não cobrir dispositivos relevantes.
- **Confiar em extensão ou MIME declarado**: rejeitada porque não valida o
  conteúdo integral do arquivo.
