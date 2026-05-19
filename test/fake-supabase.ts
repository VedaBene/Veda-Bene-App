type Row = Record<string, unknown>

type QueryFilter =
  | { kind: 'eq'; column: string; value: unknown }
  | { kind: 'gte'; column: string; value: unknown }
  | { kind: 'lte'; column: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'or'; clauses: { column: string; value: unknown }[] }

export type SupabaseSelectCall = {
  table: string
  columns: string
  options?: unknown
}

export class FakeSupabase {
  readonly selectCalls: SupabaseSelectCall[] = []
  readonly updates: { table: string; values: Row; filters: QueryFilter[] }[] = []

  constructor(private readonly tableData: Record<string, Row[]>) {}

  from(table: string): FakeQuery {
    return new FakeQuery(this, table, this.tableData[table] ?? [])
  }
}

export class FakeQuery implements PromiseLike<{ data: Row[] | Row | null; count: number | null; error: null }> {
  private filters: QueryFilter[] = []
  private orderBy: { column: string; ascending: boolean } | null = null
  private rangeBounds: { from: number; to: number } | null = null
  private singleResult = false
  private updatedValues: Row | null = null

  constructor(
    private readonly client: FakeSupabase,
    private readonly table: string,
    private readonly rows: Row[],
  ) {}

  select(columns: string, options?: unknown): this {
    this.client.selectCalls.push({ table: this.table, columns, options })
    return this
  }

  update(values: Row): this {
    this.updatedValues = values
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'eq', column, value })
    return this
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ kind: 'gte', column, value })
    return this
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ kind: 'lte', column, value })
    return this
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ kind: 'in', column, values })
    return this
  }

  or(expression: string): this {
    const clauses = expression.split(',').flatMap(part => {
      const [column, operator, ...valueParts] = part.split('.')
      if (operator !== 'eq') return []
      return [{ column, value: valueParts.join('.') }]
    })
    this.filters.push({ kind: 'or', clauses })
    return this
  }

  ilike(): this {
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending ?? true }
    return this
  }

  range(from: number, to: number): this {
    this.rangeBounds = { from, to }
    return this
  }

  single(): this {
    this.singleResult = true
    return this
  }

  then<TResult1 = { data: Row[] | Row | null; count: number | null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | Row | null; count: number | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }

  private execute(): { data: Row[] | Row | null; count: number | null; error: null } {
    if (this.updatedValues) {
      this.client.updates.push({ table: this.table, values: this.updatedValues, filters: this.filters })
      return { data: null, count: null, error: null }
    }

    let data = this.rows.filter(row => this.filters.every(filter => matchesFilter(row, filter)))
    const count = data.length

    if (this.orderBy) {
      const { column, ascending } = this.orderBy
      data = [...data].sort((left, right) => compareValues(left[column], right[column], ascending))
    }

    if (this.rangeBounds) {
      data = data.slice(this.rangeBounds.from, this.rangeBounds.to + 1)
    }

    return {
      data: this.singleResult ? (data[0] ?? null) : data,
      count,
      error: null,
    }
  }
}

function matchesFilter(row: Row, filter: QueryFilter): boolean {
  switch (filter.kind) {
    case 'eq':
      return row[filter.column] === filter.value
    case 'gte':
      return String(row[filter.column] ?? '') >= String(filter.value)
    case 'lte':
      return String(row[filter.column] ?? '') <= String(filter.value)
    case 'in':
      return filter.values.includes(row[filter.column])
    case 'or':
      return filter.clauses.some(clause => row[clause.column] === clause.value)
  }
}

function compareValues(left: unknown, right: unknown, ascending: boolean): number {
  const result = String(left ?? '').localeCompare(String(right ?? ''))
  return ascending ? result : -result
}
