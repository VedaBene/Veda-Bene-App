import { redirect } from 'next/navigation'

/**
 * Rota raiz — redireciona para ordens de serviço.
 * O proxy.ts gerencia a autenticação: se não estiver logado,
 * o usuário será redirecionado para /login automaticamente.
 */
export default function RootPage() {
  redirect('/service-orders')
}
