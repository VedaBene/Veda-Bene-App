# ADR 011 — Taxa fixa de Consegna na receita da OS

**Status**: Aceita
**Data**: 2026-07-12

## Contexto

A Consegna é uma atividade operacional distinta da limpeza. A empresa deve
cobrar €10 por Consegna em toda Ordem de Serviço (OS), sem transformar esse
valor em horas ou remuneração de funcionários.

Como `total_price` é a fonte persistida para os relatórios de receita, a taxa
precisa fazer parte do total da OS desde a sua criação e também nos totais
históricos já gravados.

## Decisão

1. Toda OS possui `consegna_fee` fixada em €10 por uma restrição do banco.
2. O cálculo canônico passa a ser `total_price = valor_da_limpeza + serviços_extras + consegna_fee`.
3. A taxa é receita exclusiva da Veda Bene. Ela não integra `A Pagar`, horas
   remuneradas, custo de equipe ou a regra futura de remuneração da Consegna.
4. `A Receber` e seu PDF mostram separadamente limpeza, serviços extras,
   Consegna e total da OS.
5. A migração `20260712032456_add_consegna_fee_to_service_orders.sql` atribui
   a taxa a todas as OSs existentes e adiciona €10 aos `total_price` já
   calculados, uma única vez.

Qualquer mudança no valor fixo, na incidência da taxa ou na forma de remunerar
a Consegna exige uma nova decisão e uma migração compatível; não deve ser feita
somente alterando a constante da aplicação.

## Consequências

**Positivas**:

- O total persistido, o dashboard e `A Receber` permanecem consistentes.
- O PDF torna a cobrança auditável pelo cliente.
- A separação entre receita da empresa e pagamento de funcionários fica
  explícita e testável.

**Negativas**:

- A taxa não é configurável por OS; qualquer exceção comercial requer uma nova
  regra de negócio.
- Os totais históricos aumentam €10 quando a migração é aplicada.

## Alternativas consideradas

- **Adicionar €10 somente no relatório `A Receber`**: descartada porque o
  `total_price` da OS, o dashboard e outros consumidores continuariam sem a
  mesma receita.
- **Usar a taxa para remunerar o responsável pela Consegna**: descartada
  porque a remuneração desse papel seguirá metodologia própria em decisão
  futura.
