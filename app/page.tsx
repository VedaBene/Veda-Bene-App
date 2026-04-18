import { redirect } from 'next/navigation'

/**
 * Rota raiz — redireciona para o dashboard.
 * O proxy.ts gerencia a autenticação: se não estiver logado,
 * o usuário será redirecionado para /login automaticamente.
 */
export default function RootPage() {
  redirect('/dashboard')
}
