# Fotos de limpeza das Ordens de Serviço

## Fluxo funcional

1. O funcionário seleciona até oito fotos no pop-up de início ou conclusão.
2. O navegador valida, corrige a orientação durante a decodificação, redimensiona
   e regrava cada imagem como WebP. A regravação remove EXIF e GPS.
3. Uma Server Action confirma identidade, perfil, atribuição, estado e ciclo da
   O.S. antes de reservar dois caminhos imutáveis.
4. O navegador envia `display.webp` e `thumb.webp` por URLs assinadas, sem receber
   credenciais privilegiadas.
5. O servidor confere os objetos e muda o metadado de `pending` para `ready`.
6. A transição de início/conclusão valida que os IDs prontos pertencem à mesma
   O.S., ciclo, fase e usuário.
7. A galeria consulta somente linhas liberadas pelo RLS e recebe URLs de leitura
   válidas por 15 minutos.

Fotos são opcionais. Uma transição com lista vazia preserva o comportamento
anterior.

## Limites

| Item | Limite |
|---|---:|
| Fotos por fase e ciclo | 8 |
| Arquivo selecionado | 20 MB |
| Lado maior da visualização | 1920 px |
| Visualização WebP | 2 MB |
| Lado maior da miniatura | 480 px |
| Miniatura WebP | 512 KB no servidor; alvo menor no navegador |

Formatos aceitos: JPEG, PNG e WebP. HEIC/HEIF gera uma orientação clara ao
usuário em vez de enviar um original não otimizado.

## Autorização

- `admin` e `secretaria`: fotos de todas as O.S. visíveis.
- `limpeza`: somente O.S. às quais o funcionário está associado.
- `consegna`: somente O.S. atribuídas, para consulta.
- `cliente`: somente fotos de suas próprias O.S. concluídas.
- Exclusão: somente `admin`.

O RLS de `service_order_photos` reutiliza o escopo de leitura de
`service_orders`. O bucket permanece privado e sem policies diretas para
`anon`/`authenticated`.

## Ciclos e reabertura

`service_orders.cleaning_cycle` começa em 1. A reabertura condicional de uma O.S.
concluída incrementa o ciclo e limpa apenas o rastreamento temporal/notas. Fotos
anteriores não são alteradas. A galeria mostra o ciclo mais recente primeiro.

## Implantação

1. Manter `CLEANING_PHOTOS_ENABLED=false` durante a preparação do schema.
2. Cumprir integralmente a política em `docs/production-data-safety.md`, incluindo
   backup/restauração verificados, dry-run, invariantes e autorização explícita.
3. Aplicar a migration versionada
   `20260722041920_add_service_order_cleaning_photos.sql`.
4. Confirmar que as invariantes das O.S. não mudaram e validar tabela,
   constraints, índices, grants, RLS e bucket privado.
5. Publicar a aplicação.
6. Fazer smoke test autenticado com a flag ainda desligada.
7. Publicar a aplicação, que habilita a funcionalidade por padrão. Para uma
   contenção emergencial, definir `CLEANING_PHOTOS_ENABLED=false` e
   reiniciar/republicar a aplicação.
8. Testar início, conclusão, galeria e negações de acesso.
9. Monitorar erros da aplicação e logs do Storage.

## Rollback

- Em qualquer estado: definir `CLEANING_PHOTOS_ENABLED=false` e republicar a
  versão anterior, preservando coluna, tabela, bucket, metadados e objetos para
  correção futura.
- Suspeita de exposição: desativar a flag, revogar `SELECT` de `authenticated`
  por meio do script de contenção em `supabase/rollback/` e manter o bucket
  privado. URLs já emitidas expiram em até 15 minutos.
- Não existe rollback destrutivo, mesmo antes do primeiro upload. A recuperação
  de schema ocorre por uma nova migração progressiva.

Ao iniciar um novo envio, reservas `pending` abandonadas pelo mesmo usuário são
removidas. Pendências de outros operadores com mais de 24 horas também são
limpas oportunisticamente para evitar bloqueio dos oito espaços da fase.
