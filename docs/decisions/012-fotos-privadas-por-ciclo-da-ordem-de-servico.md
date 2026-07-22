# ADR 012 — Fotos privadas antes/depois por ciclo da Ordem de Serviço

**Status**: Aceita
**Data**: 2026-07-21

## Contexto

Funcionários precisam registrar o estado do imóvel antes de iniciar e depois de
concluir a limpeza. As imagens contêm dados potencialmente sensíveis do imóvel,
podem ser grandes e precisam continuar historicamente corretas quando uma O.S.
concluída é reaberta.

Banco e Storage não oferecem uma transação distribuída única. Também não é
aceitável tornar o bucket público ou entregar a chave `service_role` ao
navegador.

## Decisão

- Usar o bucket privado `service-order-photos`.
- Armazenar metadados em `public.service_order_photos`, com RLS de leitura.
- Separar `before` e `after` e registrar `cycle_no` em cada foto.
- Incrementar `service_orders.cleaning_cycle` a cada reabertura.
- Manter objetos em caminhos imutáveis com UUID, sem `upsert`.
- Emitir URLs assinadas server-side para o caminho exato de upload e URLs de
  leitura com validade de 15 minutos.
- Não criar policies de acesso direto em `storage.objects` para o bucket.
- Publicar em duas fases: `pending` durante upload e `ready` somente depois de
  validar os dois arquivos, MIME, assinatura WebP, dimensões e tamanho.
- Reprocessar a imagem no navegador para remover EXIF/GPS, limitar a resolução e
  gerar antecipadamente `display.webp` e `thumb.webp`.
- Usar `CLEANING_PHOTOS_ENABLED` como flag server-only. Após a implantação do
  schema em produção, a funcionalidade fica ativa por padrão e o valor explícito
  `false` permanece como mecanismo de contenção emergencial.
- Fazer rollback exclusivamente pela flag e por uma versão anterior compatível,
  preservando coluna, tabela, bucket, metadados e imagens. Correções de schema
  são sempre progressivas; não há down migration destrutiva.

## Consequências

**Positivas**:

- Fotos não ficam públicas nem dependem de URLs permanentes.
- Registros incompletos não aparecem na galeria.
- Reaberturas preservam e separam o histórico.
- Miniaturas reduzem tráfego e dispensam transformações pagas em tempo de
  consulta.
- A versão anterior do aplicativo continua compatível com a migração aditiva.
- Falhas podem ser contidas sem apagar histórico nem estruturas já implantadas.

**Negativas**:

- É necessário coordenar Storage e Postgres por estado, idempotência e limpeza
  de reservas antigas.
- URLs já assinadas não podem ser revogadas individualmente antes de expirarem;
  por isso a validade de leitura é curta.
- HEIC/HEIF não é enviado na primeira versão. O aplicativo apresenta mensagem
  explícita e aceita JPEG, PNG e WebP.
- A validação final baixa até 2,5 MB por foto no servidor para conferir o
  conteúdo dos dois arquivos.

## Alternativas consideradas

- **Bucket público**: descartado por expor o interior dos imóveis.
- **Upload autenticado direto com policies complexas em `storage.objects`**:
  descartado para reduzir a superfície de autorização e manter os caminhos sob
  controle do servidor.
- **Guardar imagens no Postgres**: descartado por custo, manutenção e impacto em
  backup.
- **Guardar somente o original e transformar na consulta**: descartado por
  aumentar armazenamento, tráfego e custo recorrente de transformação.
- **Excluir fotos antigas ao reabrir**: descartado porque destruiria o histórico
  solicitado.
