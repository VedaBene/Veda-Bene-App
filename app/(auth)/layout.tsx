export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Veda Bene</h1>
          <p className="text-sm text-gray-500 mt-1">Gestione Ordini di Servizio</p>
        </div>
        {children}
      </div>
    </div>
  )
}
