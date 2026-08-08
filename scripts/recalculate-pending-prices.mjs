import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  console.error(
    'Defina SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) antes de executar o script.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const RIPASSO_RATE = 0.6
const OUT_LONG_STAY_HOURLY_RATE = 25
const CONSEGNA_FEE = 10

function calculateTotalPrice(
  pricingMode,
  basePrice,
  extraPerPerson,
  realGuests,
  minGuests,
  extraServicesPrice = null,
  workedMinutes = null,
) {
  const extras = extraServicesPrice ?? 0
  let cleaningPrice = null

  if (pricingMode === 'standard') {
    if (basePrice == null) return null
    const extra = extraPerPerson ?? 0
    const guests = realGuests ?? 0
    const min = minGuests ?? 0
    cleaningPrice = basePrice + extra * Math.max(0, guests - min) + extras
  } else if (pricingMode === 'ripasso') {
    if (basePrice == null) return null
    cleaningPrice = basePrice * RIPASSO_RATE + extras
  } else if (pricingMode === 'out_long_stay') {
    if (workedMinutes == null) return null
    cleaningPrice = (workedMinutes / 60) * OUT_LONG_STAY_HOURLY_RATE + extras
  }

  return cleaningPrice == null ? null : cleaningPrice + CONSEGNA_FEE
}

async function run() {
  console.log('==================================================')
  console.log('SCRIPT DE RECÁLCULO E RECONCILIAÇÃO DE PREÇOS (OS)')
  console.log('==================================================\n')

  // Fetch all service orders with total_price IS NULL
  const { data: nullOrders, error } = await supabase
    .from('service_orders')
    .select(`
      id, order_number, cleaning_date, status, pricing_mode, real_guests, extra_services_price, worked_minutes,
      property:properties(id, name, base_price, extra_per_person, min_guests)
    `)
    .is('total_price', null)

  if (error) {
    console.error('Erro ao buscar ordens pendentes:', error)
    process.exit(1)
  }

  console.log(`Encontradas ${nullOrders.length} ordens de serviço com total_price = NULL no banco de dados.`)

  let updatedCount = 0
  let skippedCount = 0

  for (const order of nullOrders) {
    const prop = order.property
    const computedPrice = prop
      ? calculateTotalPrice(
          order.pricing_mode,
          prop.base_price,
          prop.extra_per_person,
          order.real_guests,
          prop.min_guests,
          order.extra_services_price,
          order.worked_minutes,
        )
      : null

    if (computedPrice !== null) {
      const { error: updateErr } = await supabase
        .from('service_orders')
        .update({ total_price: computedPrice })
        .eq('id', order.id)

      if (updateErr) {
        console.error(`Erro ao atualizar OS #${order.order_number}:`, updateErr.message)
      } else {
        updatedCount++
        console.log(`✓ OS #${order.order_number} (${order.cleaning_date}) | Imóvel: "${prop.name}" -> total_price atualizado para ${computedPrice.toFixed(2)} €`)
      }
    } else {
      skippedCount++
      console.log(`⚠️ OS #${order.order_number} (${order.cleaning_date}) | Imóvel: "${prop?.name ?? 'Desconhecido'}" -> Não foi possível calcular (Preço base do imóvel ou minutos ausentes).`)
    }
  }

  console.log('\n==================================================')
  console.log(`RESUMO DA EXECUÇÃO:`)
  console.log(`  - Ordens processadas: ${nullOrders.length}`)
  console.log(`  - Ordens recalculadas e atualizadas com sucesso: ${updatedCount}`)
  console.log(`  - Ordens ignoradas por falta de cadastro base: ${skippedCount}`)
  console.log('==================================================')
}

run()
