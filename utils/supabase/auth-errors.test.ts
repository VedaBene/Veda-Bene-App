import { describe, expect, it } from 'vitest'

import { getPasswordUpdateError } from './auth-errors'

describe('getPasswordUpdateError', () => {
  it('explica de forma segura quando a senha é fraca ou vazada', () => {
    expect(getPasswordUpdateError({ code: 'weak_password' })).toBe(
      'Esta senha é insegura ou já apareceu em vazamentos. Escolha uma senha diferente e mais forte.',
    )
  })

  it('reconhece a classe de erro de senha fraca do cliente Supabase', () => {
    expect(getPasswordUpdateError({ name: 'AuthWeakPasswordError' })).toContain('já apareceu em vazamentos')
  })

  it('orienta a solicitar outro link quando a sessão expirou', () => {
    expect(getPasswordUpdateError({ code: 'session_expired' })).toBe(
      'A sessão do link expirou. Solicite um novo link e tente novamente.',
    )
  })

  it('não repassa mensagens técnicas desconhecidas ao usuário', () => {
    const technicalMessage = 'provider-internal-detail'

    expect(getPasswordUpdateError({ message: technicalMessage })).toBe(
      'Não foi possível definir a senha. Tente novamente ou solicite um novo link.',
    )
    expect(getPasswordUpdateError({ message: technicalMessage })).not.toContain(technicalMessage)
  })
})
