'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRole } from '@/lib/hooks/useRole'
import { createClient } from '@/utils/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', roles: ['admin', 'secretaria', 'limpeza', 'consegna', 'cliente'] },
  { href: '/properties', label: 'Imóveis', roles: ['admin', 'secretaria', 'limpeza', 'consegna', 'cliente'] },
  { href: '/service-orders', label: 'Ordens de Serviço', roles: ['admin', 'secretaria', 'limpeza', 'consegna', 'cliente'] },
  { href: '/employees', label: 'Funcionários', roles: ['admin', 'secretaria'] },
  { href: '/statements/payable', label: 'Extratos a Pagar', roles: ['admin'] },
  { href: '/statements/receivable', label: 'Extratos a Receber', roles: ['admin', 'secretaria'] },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { role } = useRole()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleItems = navItems.filter(
    (item) => !role || (item.roles as readonly string[]).includes(role)
  )

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-800 flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="text-white font-bold text-lg">Veda Bene</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-4 border-t border-gray-700">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  )
}
