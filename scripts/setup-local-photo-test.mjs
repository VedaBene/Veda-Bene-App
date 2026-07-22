import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const testPassword = process.env.LOCAL_TEST_PASSWORD

if (!supabaseUrl || !serviceRoleKey || !testPassword) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and LOCAL_TEST_PASSWORD are required.',
  )
}

const localUrl = new URL(supabaseUrl)
if (!['localhost', '127.0.0.1'].includes(localUrl.hostname)) {
  throw new Error('Refusing to seed a non-local Supabase project.')
}

if (testPassword.length < 12) {
  throw new Error('LOCAL_TEST_PASSWORD must contain at least 12 characters.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const accounts = [
  { email: 'admin.586@local.vedabene.test', name: 'Admin Local 586', role: 'admin' },
  {
    email: 'secretaria.586@local.vedabene.test',
    name: 'Secretaria Local 586',
    role: 'secretaria',
  },
  {
    email: 'limpeza.586@local.vedabene.test',
    name: 'Limpeza Local 586',
    role: 'limpeza',
  },
  {
    email: 'consegna.586@local.vedabene.test',
    name: 'Consegna Local 586',
    role: 'consegna',
  },
  {
    email: 'cliente.586@local.vedabene.test',
    name: 'Cliente Local 586',
    role: 'cliente',
  },
]

async function listAllUsers() {
  const users = []

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error

    users.push(...data.users)
    if (data.users.length < 100) return users
  }
}

const existingUsers = await listAllUsers()
const userIds = new Map()

for (const account of accounts) {
  let user = existingUsers.find(
    (candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase(),
  )

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: account.name },
    })
    if (error) throw error
    user = data.user
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: account.name },
    })
    if (error) throw error
    user = data.user
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: account.name, email: account.email, role: account.role })
    .eq('id', user.id)

  if (profileError) throw profileError
  userIds.set(account.role, user.id)
}

const ownerId = '15860000-0000-4000-8000-000000000001'
const propertyId = '25860000-0000-4000-8000-000000000001'
const serviceOrderId = '35860000-0000-4000-8000-000000000001'
const client = accounts.find((account) => account.role === 'cliente')

const { error: ownerError } = await supabase.from('owners').upsert({
  id: ownerId,
  name: 'Cliente Local África',
  email: client.email,
  phone: '+39 000 000 0586',
})
if (ownerError) throw ownerError

const { error: propertyError } = await supabase.from('properties').upsert({
  id: propertyId,
  name: 'África',
  client_type: 'particular',
  agency_id: null,
  owner_id: ownerId,
  zone: 'Other areas',
  address: 'Ambiente local de testes',
  min_guests: 1,
  max_guests: 4,
  base_price: 100,
  extra_per_person: 10,
  avg_cleaning_hours: 4,
})
if (propertyError) throw propertyError

const { error: serviceOrderError } = await supabase.from('service_orders').upsert({
  id: serviceOrderId,
  order_number: 586,
  property_id: propertyId,
  cleaning_staff_id: userIds.get('limpeza'),
  consegna_staff_id: userIds.get('consegna'),
  cleaning_date: '2026-07-22',
  checkout_at: '2026-07-22T13:00:00+02:00',
  checkin_at: '2026-07-22T17:00:00+02:00',
  status: 'open',
  real_guests: 2,
  total_price: 100,
  pricing_mode: 'standard',
  cleaning_notes: 'Usar exclusivamente esta O.S. para a validação local das fotos.',
})
if (serviceOrderError) throw serviceOrderError

const { error: assignmentError } = await supabase
  .from('service_order_cleaning_staff')
  .upsert(
    { service_order_id: serviceOrderId, profile_id: userIds.get('limpeza') },
    { onConflict: 'service_order_id,profile_id' },
  )
if (assignmentError) throw assignmentError

console.log('Local photo test data is ready.')
console.log('Service order: 586')
console.log('Property: África')
console.log(`Local accounts: ${accounts.map((account) => account.email).join(', ')}`)
