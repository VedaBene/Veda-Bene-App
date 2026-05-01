'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRole } from '@/lib/hooks/useRole'
import { createClient } from '@/utils/supabase/client'
import {
  LayoutDashboard,
  Home,
  ClipboardList,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  LogOut,
  X,
  Sparkles,
} from 'lucide-react'
import { Dispatch, SetStateAction } from 'react'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: readonly string[]
  group?: string
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { href: '/properties', label: 'Immobili', icon: Home, roles: ['admin', 'secretaria', 'limpeza', 'consegna', 'cliente'] },
  { href: '/service-orders', label: 'Ordini di Lavoro', icon: ClipboardList, roles: ['admin', 'secretaria', 'limpeza', 'consegna', 'cliente'] },
  { href: '/employees', label: 'Funcionários', icon: Users, roles: ['admin'] },
  { href: '/statements/payable', label: 'A Pagar', icon: ArrowUpRight, roles: ['admin'], group: 'Financeiro' },
  { href: '/statements/receivable', label: 'A Receber', icon: ArrowDownLeft, roles: ['admin'], group: 'Financeiro' },
]

type SidebarProps = {
  isOpen: boolean
  setIsOpen: Dispatch<SetStateAction<boolean>>
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { role } = useRole()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleItems = navItems.filter(
    (item) => !role || item.roles.includes(role)
  )
  const groupedItems = visibleItems.map((item, index) => ({
    item,
    showGroupLabel: !!item.group && item.group !== visibleItems[index - 1]?.group,
  }))

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar-bg border-r border-sidebar-border flex flex-col transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-sidebar-border shrink-0">
          <Link href="/service-orders" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-card">
              <Sparkles size={16} className="text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-primary font-bold text-base tracking-tight leading-tight">Veda Bene</span>
              <span className="text-[10px] text-muted-foreground leading-tight font-medium">Servizi di pulizia</span>
            </div>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
          {groupedItems.map(({ item, showGroupLabel }) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <div key={item.href}>
                {showGroupLabel && (
                  <div className="px-3 pt-5 pb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      {item.group}
                    </span>
                  </div>
                )}
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 group relative ${isActive
                      ? 'bg-sidebar-active-bg text-sidebar-active'
                      : 'text-sidebar-text hover:bg-muted/60 hover:text-sidebar-text-hover'
                    }`}
                  onClick={() => setIsOpen(false)}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full" />
                  )}
                  <Icon size={18} className={isActive ? 'text-accent' : 'text-sidebar-text group-hover:text-sidebar-text-hover'} />
                  <span>{item.label}</span>
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Sign Out */}
        <div className="p-3 border-t border-sidebar-border shrink-0">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium text-danger/80 hover:bg-danger-bg hover:text-danger transition-all duration-200 cursor-pointer"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}
