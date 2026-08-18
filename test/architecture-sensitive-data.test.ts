import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SOURCE_ROOTS = ['app', 'components', 'lib', 'utils']
const PRIVILEGED_MODULES = new Set([
  'lib/server/data-access/sensitive-data.ts',
  'lib/server/auth/login-lockout.ts',
  'lib/server/storage/service-order-photo-storage.ts',
  'utils/supabase/admin.ts',
])
const SENSITIVE_TABLES = new Set(['profiles', 'properties', 'service_orders'])
const SENSITIVE_COLUMNS = [
  'hourly_rate',
  'monthly_salary',
  'overtime_rate',
  'base_price',
  'extra_per_person',
  'avg_cleaning_hours',
  'total_price',
  'extra_services_price',
  'consegna_fee',
]

function sourceFiles(): string[] {
  const files: string[] = []
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) files.push(absolute)
    }
  }
  for (const sourceRoot of SOURCE_ROOTS) visit(path.join(ROOT, sourceRoot))
  return files
}

function relative(file: string): string {
  return path.relative(ROOT, file).replaceAll('\\', '/')
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

function literalText(node: ts.Node | undefined): string | null {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null
}

function tableFromExpression(node: ts.Node): string | null {
  if (ts.isCallExpression(node)) {
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'from') {
      return literalText(node.arguments[0])
    }
    return tableFromExpression(node.expression)
  }
  if (ts.isPropertyAccessExpression(node)) return tableFromExpression(node.expression)
  return null
}

function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = path.join(ROOT, specifier.slice(2))
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromFile), specifier)
  else return null

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

describe('sensitive-data architecture boundaries', () => {
  const files = sourceFiles()
  const parsed = new Map(files.map(file => [file, parse(file)]))

  it('keeps sensitive selects inside the approved privileged adapter and forbids wildcard selects', () => {
    const violations: string[] = []

    for (const [file, source] of parsed) {
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'select'
        ) {
          const table = tableFromExpression(node.expression.expression)
          const selection = literalText(node.arguments[0])
          if (table && SENSITIVE_TABLES.has(table) && selection) {
            if (selection.trim() === '*') violations.push(`${relative(file)}: select('*') em ${table}`)
            const touchesSensitive = SENSITIVE_COLUMNS.some(column => selection.includes(column))
            if (touchesSensitive && relative(file) !== 'lib/server/data-access/sensitive-data.ts') {
              violations.push(`${relative(file)}: select sensível em ${table}`)
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }

    expect(violations).toEqual([])
  })

  it('prevents privileged modules from entering any client-component import graph', () => {
    const imports = new Map<string, string[]>()
    const clientEntries: string[] = []
    const serverActionBoundaries = new Set<string>()

    for (const [file, source] of parsed) {
      const first = source.statements[0]
      if (first && ts.isExpressionStatement(first) && literalText(first.expression) === 'use client') {
        clientEntries.push(file)
      }
      if (first && ts.isExpressionStatement(first) && literalText(first.expression) === 'use server') {
        serverActionBoundaries.add(file)
      }
      imports.set(file, source.statements.flatMap(statement => {
        if (!ts.isImportDeclaration(statement)) return []
        const specifier = literalText(statement.moduleSpecifier)
        const resolved = specifier ? resolveImport(file, specifier) : null
        return resolved ? [resolved] : []
      }))
    }

    const violations: string[] = []
    for (const entry of clientEntries) {
      const pending = [entry]
      const visited = new Set<string>()
      while (pending.length) {
        const current = pending.pop()!
        if (visited.has(current)) continue
        visited.add(current)
        if (PRIVILEGED_MODULES.has(relative(current))) {
          violations.push(`${relative(entry)} -> ${relative(current)}`)
        }
        if (current !== entry && serverActionBoundaries.has(current)) continue
        pending.push(...(imports.get(current) ?? []))
      }
    }

    expect(violations).toEqual([])
  })

  it('does not export a raw privileged client or generic Supabase proxy', () => {
    for (const modulePath of PRIVILEGED_MODULES) {
      const source = parsed.get(path.join(ROOT, ...modulePath.split('/')))
      expect(source, modulePath).toBeDefined()
      const exportedNames: string[] = []
      for (const statement of source!.statements) {
        const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
        if (!modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
        if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
          exportedNames.push(statement.name.text)
        }
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) exportedNames.push(declaration.name.text)
          }
        }
      }
      expect(exportedNames.filter(name => (
        /supabase|query|select|(?:raw|admin|privileged|serviceRole)Client|create.*Client/i.test(name)
      ))).toEqual([])
    }
  })
})
