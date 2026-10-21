# Etapa 6 — evidências de regressão de fotos

Data de referência: 2026-10-21, Europe/Rome. Baseline do código: `2fc2d05`.
Escopo: aplicação e Supabase descartáveis locais; nenhuma mudança remota.

## Gate automatizado

- Node **22.23.3**, obtido da distribuição oficial e verificado por SHA-256.
- `npm test`: **49 arquivos / 434 testes aprovados**. Corrigida somente a
  asserção de identidade de `File` no teste da fila; os objetos distintos eram
  comparados estruturalmente pelo matcher no Node 22.
  Quatro testes adicionais protegem a separação dos relatórios Android/Safari,
  rejeitam Chrome no iPhone como cobertura Safari e preservam resultados
  ausentes ou falhos sem inventar aprovação.
- `npm run lint` e `npm run typecheck`: aprovados.
- Build de produção Next.js 16.3.1 em Node 22: aprovado dentro do runner E2E,
  com URL/chaves exclusivamente locais e Sentry desabilitado. Executável
  standalone real, com assets copiados para o diretório de execução.
- `npm run test:supabase`: **253 testes pgTAP aprovados**, invariantes de
  visibilidade e formatos de fotos aprovadas, smoke histórico das duas
  migrations de fotos aprovado; lint/advisor locais sem achados.
- `npm run test:e2e`: **5 testes aprovados**, incluindo quatro testes críticos
  preexistentes e o novo percurso integrado de fotos.

O percurso de fotos comprova:

1. JPEG inválido reproduz `decode_failed` com feedback, sem reserva no banco.
2. JPEG sintético válido de 2–8 MB e orientação EXIF 6 é publicado em retrato
   (1440 × 1920), junto de PNG válido.
3. Interrupção real de uma requisição de miniatura aciona limpeza e um único
   ciclo adicional; duas fotos ficam `ready`, sem duplicação.
4. Fallback HTML real funciona com `createImageBitmap` deliberadamente
   indisponível no navegador.
5. Seleção de nove fotos aceita oito e apresenta o limite.
6. Início e conclusão persistem as fotos nas fases corretas; galeria e imagem
   ampliada funcionam por URLs assinadas.
7. Reserva fora da atribuição e por `consegna`/`cliente` é negada no servidor;
   exclusão é permitida ao admin e negada a `limpeza`, inclusive por chamada
   direta da Server Action.
8. Após a exclusão administrativa há exatamente nove metadados `ready` e
   dezoito variantes, sem linha `pending` ou pasta órfã no cenário executado.

Uma Server Action transmitida pode devolver HTTP 200 com registro de erro
Flight. O teste verifica o registro de erro e a preservação dos dados, em vez
de tratar apenas o status HTTP como autorização.

## Relação com os eventos de produção

A consulta Sentry anterior, desde 10/10/2026, encontrou 34 registros em sete
issues: 15 `decode_failed`, 8 `photo_cleanup_manual_attention`, 3
`photo_cleanup_unconfirmed`, 4 `photo_workflow_failed` e 4 erros genéricos de
ação. São registros, não contagem de fotos ou tentativas distintas. A release
`960ebbb` inclui a etapa 5. Não há identificação suficiente de aparelho e
navegador nesses eventos para aprovar a matriz móvel.

Consulta Supabase estritamente agregada e somente leitura, na execução desta
etapa, encontrou desde 10/10 (Europe/Rome): **4.326 fotos `ready`** e **duas
`pending` com mais de 24 horas**. Esses valores não medem a taxa de erro: falhas
de decode não criam metadados, e registros podem ter sido removidos pelo CRUD.
Nenhum metadado ou objeto remoto foi alterado.

Nos testes controlados, o processamento de JPEG válido e a recuperação da
miniatura interrompida passaram. A causa específica das falhas de produção
continua **NOT VERIFIED**: não foi demonstrado que os arquivos originais eram
válidos, e erros genéricos não permitem estabelecer a causa remota. Não houve
correção especulativa no código das etapas 1 ou 3.

## Matriz móvel e execução interativa

Android/Chrome real: **7/7 cenários aprovados pelo usuário** no formulário
`android-manual.json`: câmera, galeria, orientação, oito fotos, antes/depois,
reconexão e reabertura das fotos salvas. Chrome `155.0.0.0`, Android `10`,
contexto seguro e disponibilidade de `crypto.randomUUID` confirmados pelo
formulário. Instalação do certificado informada pelo usuário. Os resultados
manuais são autorrelatados, não uma inspeção remota do aparelho.
iPhone/Safari real: **7/7 cenários aprovados pelo usuário** no formulário
`iphone-safari-manual.json`, com contexto seguro e disponibilidade de
`crypto.randomUUID` confirmados. Versões informadas pelo navegador: Safari
`27.0.1`, iOS `18.7`. Mesmos sete cenários do Android. O formulário registra
a declaração do usuário; não constitui inspeção remota do aparelho.

`npm run test:photos:mobile` cria uma nova instância descartável e a aplicação
de produção para o teste manual. Requer variáveis de ambiente:
`PHOTO_TEST_HOST` (IPv4 privada ativa), `PHOTO_TEST_CERT`, `PHOTO_TEST_KEY` e
`PHOTO_TEST_CA` (arquivos externos ao repositório). `PHOTO_TEST_APP_NODE` pode
selecionar explicitamente o Node 22 para build e aplicação. Não colocar
conteúdo de chaves ou senhas na documentação.

- Página HTTP na porta 3442 serve somente instruções e certificado **público**.
- HTTPS na porta 3443 encaminha aplicação e endpoints necessários de
  Auth/REST/Storage para serviços locais. Host e sub-rede são conferidos.
- Login de teste usa perfis fictícios; credenciais geradas permanecem na memória
  do runner. A página não exibe senhas, JWTs ou chaves administrativas.
- O Android deve confiar na CA local antes do teste HTTPS. Remover a CA do
  aparelho quando o teste terminar. A CA privada não é servida pela aplicação.
- O formulário registra somente resultados enumerados e versões técnicas em
  `android-manual.json` ou `iphone-safari-manual.json`, conforme plataforma e
  navegador. Outros navegadores usam `other-manual.json` e não sobrescrevem a
  matriz aprovada. Não coleta fotos, nomes, IPs ou tokens.
- O botão de encerrar remove somente o projeto local temporário. Os dados de
  teste são descartáveis; o relatório de resultados é preservado.
- Traces Playwright foram desabilitados para não reter senhas, JWTs ou URLs
  assinadas em artefatos. Screenshots de falha usam exclusivamente dados
  sintéticos.

**Etapa 6 concluída:** gate automatizado aprovado e matriz móvel real aprovada
em Android/Chrome e iPhone/Safari, sem lacuna de aparelho aceita em substituição
ao teste. A etapa 7 permanece planejada e não foi iniciada.

O acesso Wi-Fi foi preparado em `http://192.168.15.9:3442/` (instruções/CA) e
`https://192.168.15.9:3443/__photo-test` (teste). Login, contexto seguro, geração
de UUID e preview foram verificados no Chrome automatizado de desktop; isso
não constitui teste em Android real. Verificações do acesso local: página e
landing 200; endpoint Auth administrativo 403; tentativa de ler chave privada
404; request-target absoluto rejeitado com 400. O aplicativo roda em Node 22;
o acesso HTTPS usa o Node já autorizado no firewall do Windows.

Após o Android, o usuário registrou os sete resultados e acionou o encerramento.
O runner removeu somente o projeto local descartável; o relatório manual foi
preservado. Um novo ambiente foi preparado para Safari após o usuário confirmar
dispor de um iPhone. O hash SHA-256 do relatório Android permaneceu inalterado.
O certificado público para iPhone é servido também em DER (`.cer`), da mesma CA
local. A página inclui a instalação em Ajustes/Perfil Baixado e a ativação da
confiabilidade em Geral/Sobre/Certificados Confiáveis, conforme a Apple:
https://support.apple.com/pt-br/102390 e https://support.apple.com/pt-br/102400.
O relatório Safari foi registrado com os sete cenários aprovados e contexto
seguro. O usuário acionou o encerramento; o runner confirmou a remoção somente
da nova instância local descartável. Ambos os relatórios foram preservados,
e o hash do Android permaneceu inalterado. Nenhum servidor de teste ou container
Supabase local permaneceu em execução após esse encerramento.

A aprovação demonstra os cenários executados. A causa específica das falhas
originais do Sentry continua não reproduzida; a conclusão da regressão local
não comprova resolução desses eventos em produção. A validação ocorreu antes
de qualquer commit, push ou deploy desta entrega, sem alterações remotas.
