import { describe, expect, it, vi, beforeEach } from 'vitest'
import { inviteEmployee, type InviteEmployeeInput } from './invite-employee'
import type { EmployeeAdminAdapter, EmployeeProfile, EmployeeProfileUpdateData } from '@/utils/supabase/admin'
import * as authz from '@/lib/server/authz'

describe('inviteEmployee saga and idempotency use case', () => {
  beforeEach(() => {
    vi.spyOn(authz, 'getAuthorizedClient').mockResolvedValue({
      supabase: {} as unknown as Awaited<ReturnType<typeof authz.getAuthorizedClient>>['supabase'],
      userId: 'admin-1',
      role: 'admin',
    })
  })

  function createFakeAdapter(overrides?: Partial<EmployeeAdminAdapter>): EmployeeAdminAdapter {
    return {
      inviteAuthUser: vi.fn().mockResolvedValue({
        success: true,
        user: { id: 'emp-uuid-1', email: 'lucia.rossi@email.com' },
      }),
      getAuthUserByEmail: vi.fn().mockResolvedValue({
        user: { id: 'emp-uuid-1', email: 'lucia.rossi@email.com' },
      }),
      getProfileByEmail: vi.fn().mockResolvedValue({
        profile: {
          id: 'emp-uuid-1',
          email: 'lucia.rossi@email.com',
          full_name: 'Lucia Rossi',
          role: 'cliente',
        } as EmployeeProfile,
      }),
      updateProfile: vi.fn().mockResolvedValue({}),
      createProfileIfMissing: vi.fn().mockResolvedValue({}),
      deleteEmployeeAuthUser: vi.fn().mockResolvedValue({}),
      ...overrides,
    }
  }

  const sampleInput: InviteEmployeeInput = {
    full_name: 'Lucia Rossi',
    email: 'lucia.rossi@email.com',
    phone: '+39 333 1234567',
    birth_date: '1990-05-15',
    nationality: 'Italiana',
    address: 'Via Appia 120, Roma',
    role: 'limpeza',
    hourly_rate: 15.5,
    has_fixed_salary: false,
    redirectTo: 'http://localhost:3000/auth/callback',
  }

  it('1. handles clean new employee invitation (happy path)', async () => {
    const adapter = createFakeAdapter()

    const result = await inviteEmployee(sampleInput, { adapter })

    expect(result).toEqual({
      status: 'created',
      employeeId: 'emp-uuid-1',
    })
    expect(adapter.inviteAuthUser).toHaveBeenCalledTimes(1)
    expect(adapter.inviteAuthUser).toHaveBeenCalledWith({
      email: 'lucia.rossi@email.com',
      fullName: 'Lucia Rossi',
      redirectTo: 'http://localhost:3000/auth/callback',
    })
    expect(adapter.updateProfile).toHaveBeenCalledWith('emp-uuid-1', expect.objectContaining({
      full_name: 'Lucia Rossi',
      role: 'limpeza',
      phone: '+39 333 1234567',
      hourly_rate: 15.5,
    }))
    expect(adapter.deleteEmployeeAuthUser).not.toHaveBeenCalled()
  })

  it('2. detects already existing user with active divergent profile and reports conflict', async () => {
    const adapter = createFakeAdapter({
      inviteAuthUser: vi.fn().mockResolvedValue({
        success: false,
        error: {
          message: 'A user with this email address has already been registered',
          status: 422,
          isAlreadyRegistered: true,
        },
      }),
      getProfileByEmail: vi.fn().mockResolvedValue({
        profile: {
          id: 'emp-existing-1',
          email: 'lucia.rossi@email.com',
          full_name: 'Lucia Rossi',
          role: 'secretaria', // cargo ativo diferente
          phone: '+39 333 9999999',
          hourly_rate: 20,
        } as EmployeeProfile,
      }),
    })

    const result = await inviteEmployee(sampleInput, { adapter })

    expect(result).toEqual({
      status: 'already_exists',
      employeeId: 'emp-existing-1',
      error: 'Um usuário com este email já está cadastrado no sistema.',
    })
    expect(adapter.updateProfile).not.toHaveBeenCalled()
    expect(adapter.deleteEmployeeAuthUser).not.toHaveBeenCalled()
  })

  it('3. achieves idempotency on retry after previous success (same matching profile data)', async () => {
    const adapter = createFakeAdapter({
      inviteAuthUser: vi.fn().mockResolvedValue({
        success: false,
        error: {
          message: 'User already registered',
          status: 422,
          isAlreadyRegistered: true,
        },
      }),
      getProfileByEmail: vi.fn().mockResolvedValue({
        profile: {
          id: 'emp-uuid-1',
          email: 'lucia.rossi@email.com',
          full_name: 'Lucia Rossi',
          role: 'limpeza',
          phone: '+39 333 1234567',
          hourly_rate: 15.5,
        } as EmployeeProfile,
      }),
    })

    const result = await inviteEmployee(sampleInput, { adapter })

    expect(result).toEqual({
      status: 'reconciled',
      employeeId: 'emp-uuid-1',
      message: 'Funcionário já cadastrado com os dados informados.',
    })
    expect(adapter.updateProfile).not.toHaveBeenCalled()
    expect(adapter.deleteEmployeeAuthUser).not.toHaveBeenCalled()
  })

  it('4. recovers gracefully on retry after initial Auth timeout', async () => {
    // 1ª tentativa: Falha de rede/timeout no Auth
    const adapterFail = createFakeAdapter({
      inviteAuthUser: vi.fn().mockResolvedValue({
        success: false,
        error: {
          message: 'Auth service timeout',
          status: 504,
          isAlreadyRegistered: false,
        },
      }),
    })

    const result1 = await inviteEmployee(sampleInput, { adapter: adapterFail })
    expect(result1).toEqual({
      status: 'failed',
      step: 'auth',
      error: 'Auth service timeout',
    })

    // 2ª tentativa: Sucesso no Auth
    const adapterSuccess = createFakeAdapter()
    const result2 = await inviteEmployee(sampleInput, { adapter: adapterSuccess })
    expect(result2).toEqual({
      status: 'created',
      employeeId: 'emp-uuid-1',
    })
  })

  it('5. handles Auth success with profile update failure (fault injection) without deleting user', async () => {
    const adapter = createFakeAdapter({
      updateProfile: vi.fn().mockResolvedValue({
        error: { message: 'Database connection terminated unexpectedly' },
      }),
    })

    const result = await inviteEmployee(sampleInput, { adapter })

    expect(result).toEqual({
      status: 'failed',
      step: 'profile',
      employeeId: 'emp-uuid-1',
      reconciliationRequired: true,
      error: expect.stringMatching(/falha ao registrar as informações do perfil/i),
    })

    // REGRA ABSOLUTA: Não apagar usuário Auth automaticamente!
    expect(adapter.deleteEmployeeAuthUser).not.toHaveBeenCalled()
  })

  it('6. reconciles pending profile on subsequent retry after prior profile failure', async () => {
    const adapter = createFakeAdapter({
      inviteAuthUser: vi.fn().mockResolvedValue({
        success: false,
        error: {
          message: 'A user with this email address has already been registered',
          status: 422,
          isAlreadyRegistered: true,
        },
      }),
      // Perfil ficou com role 'cliente' do trigger na falha anterior
      getProfileByEmail: vi.fn().mockResolvedValue({
        profile: {
          id: 'emp-uuid-1',
          email: 'lucia.rossi@email.com',
          full_name: 'Lucia Rossi',
          role: 'cliente',
        } as EmployeeProfile,
      }),
      updateProfile: vi.fn().mockResolvedValue({}),
    })

    const result = await inviteEmployee(sampleInput, { adapter })

    expect(result).toEqual({
      status: 'reconciled',
      employeeId: 'emp-uuid-1',
    })
    expect(adapter.updateProfile).toHaveBeenCalledWith('emp-uuid-1', expect.objectContaining({
      role: 'limpeza',
      hourly_rate: 15.5,
    }))
    expect(adapter.deleteEmployeeAuthUser).not.toHaveBeenCalled()
  })

  it('7. handles lost response scenario when profile was already saved on client retry', async () => {
    const adapter = createFakeAdapter({
      inviteAuthUser: vi.fn().mockResolvedValue({
        success: false,
        error: {
          message: 'email_exists',
          isAlreadyRegistered: true,
        },
      }),
      getProfileByEmail: vi.fn().mockResolvedValue({
        profile: {
          id: 'emp-saved-1',
          email: 'lucia.rossi@email.com',
          full_name: 'Lucia Rossi',
          role: 'limpeza',
          phone: '+39 333 1234567',
          hourly_rate: 15.5,
        } as EmployeeProfile,
      }),
    })

    const result = await inviteEmployee(sampleInput, { adapter })

    expect(result).toEqual({
      status: 'reconciled',
      employeeId: 'emp-saved-1',
      message: 'Funcionário já cadastrado com os dados informados.',
    })
  })

  it('8. handles concurrent requests for the same email deterministically', async () => {
    let callCount = 0
    let sharedProfile: EmployeeProfile | null = null

    const adapter: EmployeeAdminAdapter = {
      async inviteAuthUser({ email, fullName }) {
        callCount++
        if (callCount === 1) {
          sharedProfile = {
            id: 'emp-conc-1',
            email,
            full_name: fullName,
            role: 'cliente',
          }
          return { success: true, user: { id: 'emp-conc-1', email } }
        }
        return {
          success: false,
          error: {
            message: 'User already registered',
            status: 422,
            isAlreadyRegistered: true,
          },
        }
      },
      async getAuthUserByEmail(email) {
        return { user: { id: 'emp-conc-1', email } }
      },
      async getProfileByEmail() {
        return { profile: sharedProfile }
      },
      async updateProfile(id, data: EmployeeProfileUpdateData) {
        if (sharedProfile) {
          sharedProfile = {
            ...sharedProfile,
            ...data,
          }
        }
        return {}
      },
      async createProfileIfMissing() {
        return {}
      },
      deleteEmployeeAuthUser: vi.fn().mockResolvedValue({}),
    }

    // Disparar duas chamadas simultâneas
    const [res1, res2] = await Promise.all([
      inviteEmployee(sampleInput, { adapter }),
      inviteEmployee(sampleInput, { adapter }),
    ])

    // Ambas devem ter sucesso com o mesmo ID sem criar duplicação
    const validStatuses = ['created', 'reconciled']
    expect(validStatuses).toContain(res1.status)
    expect(validStatuses).toContain(res2.status)
    if (res1.status === 'created' || res1.status === 'reconciled') {
      expect(res1.employeeId).toBe('emp-conc-1')
    }
    if (res2.status === 'created' || res2.status === 'reconciled') {
      expect(res2.employeeId).toBe('emp-conc-1')
    }
    expect(adapter.deleteEmployeeAuthUser).not.toHaveBeenCalled()
  })

  it('9. handles general adapter/network failure gracefully', async () => {
    const adapter = createFakeAdapter({
      inviteAuthUser: vi.fn().mockResolvedValue({
        success: false,
        error: {
          message: 'Network connection refused',
          status: 503,
          isAlreadyRegistered: false,
        },
      }),
    })

    const result = await inviteEmployee(sampleInput, { adapter })

    expect(result).toEqual({
      status: 'failed',
      step: 'auth',
      error: 'Network connection refused',
    })
  })

  it('10. verifies validation rejection before adapter is called', async () => {
    const adapter = createFakeAdapter()

    const result = await inviteEmployee(
      {
        ...sampleInput,
        email: 'invalid-email-format',
      },
      { adapter },
    )

    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.step).toBe('validation')
      expect(result.error).toMatch(/email/i)
    }
    expect(adapter.inviteAuthUser).not.toHaveBeenCalled()
  })

  it('11. verifies authorization check rejects non-admin users', async () => {
    vi.spyOn(authz, 'getAuthorizedClient').mockRejectedValue(new Error('Sem permissão'))
    const adapter = createFakeAdapter()

    const result = await inviteEmployee(sampleInput, { adapter })

    expect(result).toEqual({
      status: 'failed',
      step: 'authorization',
      error: 'Sem permissão',
    })
    expect(adapter.inviteAuthUser).not.toHaveBeenCalled()
  })

  it('12. handles missing profile creation if trigger failed on Auth creation', async () => {
    const adapter = createFakeAdapter({
      inviteAuthUser: vi.fn().mockResolvedValue({
        success: false,
        error: {
          message: 'A user with this email address has already been registered',
          status: 422,
          isAlreadyRegistered: true,
        },
      }),
      getProfileByEmail: vi.fn().mockResolvedValue({ profile: null }), // trigger não executou
      getAuthUserByEmail: vi.fn().mockResolvedValue({
        user: { id: 'emp-orphan-1', email: 'lucia.rossi@email.com' },
      }),
      createProfileIfMissing: vi.fn().mockResolvedValue({}),
      updateProfile: vi.fn().mockResolvedValue({}),
    })

    const result = await inviteEmployee(sampleInput, { adapter })

    expect(result).toEqual({
      status: 'reconciled',
      employeeId: 'emp-orphan-1',
    })
    expect(adapter.createProfileIfMissing).toHaveBeenCalledWith(
      'emp-orphan-1',
      'lucia.rossi@email.com',
      'Lucia Rossi',
    )
    expect(adapter.updateProfile).toHaveBeenCalledWith('emp-orphan-1', expect.objectContaining({
      role: 'limpeza',
    }))
  })
})
