'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAuthorizedClient } from '@/lib/server/authz'
import { withLogging } from '@/lib/server/logger'
import { saveProperty } from '@/lib/server/properties/save-property'
import { uuidSchema, validationMessage } from '@/lib/server/validation/contracts'

async function createPropertyImpl(formData: FormData) {
  await getAuthorizedClient(['admin'])

  const payload = Object.fromEntries(formData)
  const result = await saveProperty(payload)

  if (!result.success) {
    return { success: false as const, error: result.error }
  }

  revalidatePath('/properties')
  redirect('/properties')
}

async function updatePropertyImpl(id: string, formData: FormData) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  await getAuthorizedClient(['admin'])

  const payload = {
    ...Object.fromEntries(formData),
    id: parsedId.data,
  }
  const result = await saveProperty(payload)

  if (!result.success) {
    return { success: false as const, error: result.error }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${parsedId.data}`)
  return { success: true as const }
}

async function deletePropertyImpl(id: string) {
  const parsedId = uuidSchema.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: validationMessage(parsedId.error) }

  const { supabase } = await getAuthorizedClient(['admin'])

  const { error } = await supabase.from('properties').delete().eq('id', parsedId.data)
  if (error) return { success: false as const, error: error.message }

  revalidatePath('/properties')
  redirect('/properties')
}

export async function createProperty(formData: FormData) {
  return withLogging('createProperty', () => createPropertyImpl(formData))
}

export async function updateProperty(id: string, formData: FormData) {
  return withLogging('updateProperty', () => updatePropertyImpl(id, formData))
}

export async function deleteProperty(id: string) {
  return withLogging('deleteProperty', () => deletePropertyImpl(id))
}
