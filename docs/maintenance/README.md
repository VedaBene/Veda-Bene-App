# Registros de manutenção

Esta pasta registra correções e atualizações relevantes já executadas que não
constituem, isoladamente, uma nova decisão arquitetural. O objetivo é permitir
que mantenedores e agentes reconstruam rapidamente o contexto operacional de
uma mudança: causa, implementação, impacto, implantação, validação e riscos
residuais.

Use um ADR em `docs/decisions/` quando a mudança estabelecer ou substituir uma
decisão arquitetural durável. Use um registro de manutenção para documentar a
execução concreta, os arquivos afetados, os commits, o deploy e os pontos de
acompanhamento. Quando ambos existirem, mantenha links entre eles.

## Índice

| Data | Registro | Estado |
|---|---|---|
| 2026-08-07 | [Remediação de chave Supabase legada exposta](2026-08-07-supabase-legacy-key-exposure.md) | Remediado; legado desabilitado |
| 2026-08-04 | [Consistência entre CSV e PDF do extrato A Pagar](2026-08-04-payable-csv-pdf-consistency.md) | Implementado localmente; não implantado |
| 2026-07-30 | [Compatibilidade de fotos móveis e atualização de segurança do Next.js](2026-07-30-photo-upload-and-next-security-hardening.md) | Implantado em produção |
