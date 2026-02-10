/**
 * PostgREST-compatible query builder backed by the Neon serverless pool.
 *
 * Provides a .from().select().eq()... chaining interface so that tRPC
 * routers and helpers can use a familiar query builder pattern backed
 * by the Neon serverless pool.
 */
import { query as dbQuery } from './db';

// ---------------------------------------------------------------------------
// FK relationship map — used to resolve embed (JOIN) aliases
// ---------------------------------------------------------------------------

interface FkDef {
  column: string;
  refTable: string;
  refColumn: string;
}

const FK_RELATIONS: Record<string, Record<string, FkDef>> = {
  shifts: {
    user: { column: 'user_id', refTable: 'users', refColumn: 'id' },
    location: { column: 'location_id', refTable: 'locations', refColumn: 'id' },
    organization: { column: 'org_id', refTable: 'organizations', refColumn: 'id' },
  },
  swap_requests: {
    shift: { column: 'shift_id', refTable: 'shifts', refColumn: 'id' },
    requester: { column: 'requested_by', refTable: 'users', refColumn: 'id' },
    replacement: { column: 'replacement_user_id', refTable: 'users', refColumn: 'id' },
    reviewer: { column: 'reviewed_by', refTable: 'users', refColumn: 'id' },
  },
  callouts: {
    shift: { column: 'shift_id', refTable: 'shifts', refColumn: 'id' },
    user: { column: 'user_id', refTable: 'users', refColumn: 'id' },
    organization: { column: 'org_id', refTable: 'organizations', refColumn: 'id' },
  },
  org_members: {
    user: { column: 'user_id', refTable: 'users', refColumn: 'id' },
    organization: { column: 'org_id', refTable: 'organizations', refColumn: 'id' },
  },
  notifications: {
    user: { column: 'user_id', refTable: 'users', refColumn: 'id' },
    organization: { column: 'org_id', refTable: 'organizations', refColumn: 'id' },
  },
  claims: {
    callout: { column: 'callout_id', refTable: 'callouts', refColumn: 'id' },
    user: { column: 'user_id', refTable: 'users', refColumn: 'id' },
    approver: { column: 'approved_by', refTable: 'users', refColumn: 'id' },
    organization: { column: 'org_id', refTable: 'organizations', refColumn: 'id' },
  },
  users: {
    organization: { column: 'org_id', refTable: 'organizations', refColumn: 'id' },
  },
  organizations: {},
};

// ---------------------------------------------------------------------------
// Embed (relation) parser
// ---------------------------------------------------------------------------

interface EmbedDef {
  alias: string;
  table: string;
  columns: string; // '*' or 'col1, col2'
  fkHint?: string;
  nested: EmbedDef[];
}

/**
 * Parse a PostgREST-style select string into plain columns and embed defs.
 *
 * Examples:
 *   '*'
 *   '*, user:users(id, name, email)'
 *   '*, shift:shifts(*, user:users(id, name, email)), requester:users!swap_requests_requested_by_fkey(id, name, email)'
 */
function parseSelectString(selectStr: string): {
  mainColumns: string[];
  embeds: EmbedDef[];
} {
  const mainColumns: string[] = [];
  const embeds: EmbedDef[] = [];

  const parts = splitTopLevel(selectStr.trim());

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check if this part is an embed: alias:table(columns)
    const embedMatch = trimmed.match(
      /^(\w+):(\w+)(?:!(\w+))?\((.+)\)$/s
    );
    if (embedMatch) {
      const [, alias, table, fkHint, innerSelect] = embedMatch;
      const inner = parseSelectString(innerSelect);
      embeds.push({
        alias,
        table,
        columns: inner.mainColumns.join(', ') || '*',
        fkHint,
        nested: inner.embeds,
      });
    } else {
      mainColumns.push(trimmed);
    }
  }

  return { mainColumns, embeds };
}

/** Split a string by commas, respecting parentheses nesting. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;

    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is';

interface Filter {
  op: FilterOp;
  column: string;
  value: unknown;
}

interface OrFilter {
  raw: string; // PostgREST-style OR filter string
}

// ---------------------------------------------------------------------------
// QueryBuilder
// ---------------------------------------------------------------------------

interface SelectOptions {
  count?: 'exact';
  head?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

class QueryBuilder<T = AnyRow> {
  private _table: string;
  private _operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private _mainColumns: string[] = ['*'];
  private _embeds: EmbedDef[] = [];
  private _selectOptions: SelectOptions = {};
  private _filters: Filter[] = [];
  private _orFilters: OrFilter[] = [];
  private _orderClauses: { column: string; ascending: boolean }[] = [];
  private _limitValue: number | null = null;
  private _insertData: AnyRow | null = null;
  private _updateData: AnyRow | null = null;
  private _returning = false;

  constructor(table: string) {
    this._table = table;
  }

  select(columns: string = '*', options?: SelectOptions): QueryBuilder<T> {
    // If called after insert/update, it means RETURNING *
    if (this._operation === 'insert' || this._operation === 'update') {
      this._returning = true;
      return this;
    }
    this._operation = 'select';
    this._selectOptions = options ?? {};
    const parsed = parseSelectString(columns);
    this._mainColumns = parsed.mainColumns.length > 0 ? parsed.mainColumns : ['*'];
    this._embeds = parsed.embeds;
    return this;
  }

  insert(data: AnyRow): QueryBuilder<T> {
    this._operation = 'insert';
    this._insertData = data;
    return this;
  }

  update(data: AnyRow): QueryBuilder<T> {
    this._operation = 'update';
    this._updateData = data;
    return this;
  }

  delete(): QueryBuilder<T> {
    this._operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ op: 'neq', column, value });
    return this;
  }

  gt(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ op: 'gt', column, value });
    return this;
  }

  gte(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ op: 'gte', column, value });
    return this;
  }

  lt(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ op: 'lt', column, value });
    return this;
  }

  lte(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ op: 'lte', column, value });
    return this;
  }

  in(column: string, values: unknown[]): QueryBuilder<T> {
    this._filters.push({ op: 'in', column, value: values });
    return this;
  }

  is(column: string, value: null): QueryBuilder<T> {
    this._filters.push({ op: 'is', column, value });
    return this;
  }

  or(filter: string): QueryBuilder<T> {
    this._orFilters.push({ raw: filter });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T> {
    this._orderClauses.push({
      column,
      ascending: options?.ascending ?? true,
    });
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this._limitValue = count;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async single<R = any>(): Promise<{ data: R | null; error: any }> {
    this._limitValue = 1;
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data as R[];
    return { data: rows.length > 0 ? rows[0] : null, error: null };
  }

  /** Make the builder thenable so `await builder` works. */
  then<TResult1 = { data: T[] | null; error: unknown; count?: number }, TResult2 = never>(
    resolve?: ((value: { data: T[] | null; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(resolve, reject);
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async execute(): Promise<{ data: any[] | null; error: any; count?: number }> {
    try {
      switch (this._operation) {
        case 'select':
          return await this.executeSelect();
        case 'insert':
          return await this.executeInsert();
        case 'update':
          return await this.executeUpdate();
        case 'delete':
          return await this.executeDelete();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { data: null, error: { message } };
    }
  }

  private async executeSelect(): Promise<{ data: AnyRow[] | null; error: null; count?: number }> {
    const values: unknown[] = [];
    let paramIdx = 1;

    // Count-only query
    if (this._selectOptions.head && this._selectOptions.count === 'exact') {
      let sql = `SELECT COUNT(*)::int as count FROM ${this._table}`;
      const where = this.buildWhere(values, paramIdx);
      if (where.clause) sql += ` WHERE ${where.clause}`;
      const result = await dbQuery(sql, values);
      return { data: null, error: null, count: result.rows[0]?.count ?? 0 };
    }

    // Regular select
    const colStr = this._mainColumns.join(', ');
    let sql = `SELECT ${colStr} FROM ${this._table}`;

    const where = this.buildWhere(values, paramIdx);
    paramIdx = where.nextParam;
    if (where.clause) sql += ` WHERE ${where.clause}`;

    for (let i = 0; i < this._orderClauses.length; i++) {
      const o = this._orderClauses[i];
      sql += i === 0 ? ' ORDER BY ' : ', ';
      sql += `${o.column} ${o.ascending ? 'ASC' : 'DESC'}`;
    }

    if (this._limitValue !== null) {
      sql += ` LIMIT ${this._limitValue}`;
    }

    const result = await dbQuery(sql, values);
    let rows = result.rows;

    // Resolve embeds (relation joins) via follow-up queries
    if (this._embeds.length > 0 && rows.length > 0) {
      rows = await this.resolveEmbeds(rows, this._table, this._embeds);
    }

    return { data: rows, error: null };
  }

  private async executeInsert(): Promise<{ data: AnyRow[] | null; error: null }> {
    const data = this._insertData!;
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    let sql = `INSERT INTO ${this._table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
    if (this._returning) sql += ' RETURNING *';

    const result = await dbQuery(sql, values);
    return { data: this._returning ? result.rows : [], error: null };
  }

  private async executeUpdate(): Promise<{ data: AnyRow[] | null; error: null }> {
    const data = this._updateData!;
    const entries = Object.entries(data);
    const values: unknown[] = [];
    let paramIdx = 1;

    const setClauses = entries.map(([col, val]) => {
      values.push(val);
      return `${col} = $${paramIdx++}`;
    });

    let sql = `UPDATE ${this._table} SET ${setClauses.join(', ')}`;

    const where = this.buildWhere(values, paramIdx);
    if (where.clause) sql += ` WHERE ${where.clause}`;

    if (this._returning) sql += ' RETURNING *';

    const result = await dbQuery(sql, values);
    return { data: this._returning ? result.rows : [], error: null };
  }

  private async executeDelete(): Promise<{ data: null; error: null }> {
    const values: unknown[] = [];
    let sql = `DELETE FROM ${this._table}`;

    const where = this.buildWhere(values, 1);
    if (where.clause) sql += ` WHERE ${where.clause}`;

    await dbQuery(sql, values);
    return { data: null, error: null };
  }

  // -------------------------------------------------------------------------
  // WHERE clause builder
  // -------------------------------------------------------------------------

  private buildWhere(
    values: unknown[],
    startParam: number
  ): { clause: string; nextParam: number } {
    const parts: string[] = [];
    let paramIdx = startParam;

    for (const f of this._filters) {
      switch (f.op) {
        case 'eq':
          values.push(f.value);
          parts.push(`${f.column} = $${paramIdx++}`);
          break;
        case 'neq':
          values.push(f.value);
          parts.push(`${f.column} != $${paramIdx++}`);
          break;
        case 'gt':
          values.push(f.value);
          parts.push(`${f.column} > $${paramIdx++}`);
          break;
        case 'gte':
          values.push(f.value);
          parts.push(`${f.column} >= $${paramIdx++}`);
          break;
        case 'lt':
          values.push(f.value);
          parts.push(`${f.column} < $${paramIdx++}`);
          break;
        case 'lte':
          values.push(f.value);
          parts.push(`${f.column} <= $${paramIdx++}`);
          break;
        case 'in': {
          const arr = f.value as unknown[];
          if (arr.length === 0) {
            parts.push('FALSE');
          } else {
            const placeholders = arr.map((v) => {
              values.push(v);
              return `$${paramIdx++}`;
            });
            parts.push(`${f.column} IN (${placeholders.join(', ')})`);
          }
          break;
        }
        case 'is':
          if (f.value === null) {
            parts.push(`${f.column} IS NULL`);
          }
          break;
      }
    }

    // Parse PostgREST-style OR filters
    for (const orFilter of this._orFilters) {
      const orParts = this.parseOrFilter(orFilter.raw, values, paramIdx);
      paramIdx = orParts.nextParam;
      if (orParts.clause) {
        parts.push(`(${orParts.clause})`);
      }
    }

    return {
      clause: parts.length > 0 ? parts.join(' AND ') : '',
      nextParam: paramIdx,
    };
  }

  /**
   * Parse PostgREST OR filter syntax like:
   *   "requested_by.eq.{value},shift.user_id.eq.{value}"
   */
  private parseOrFilter(
    raw: string,
    values: unknown[],
    startParam: number
  ): { clause: string; nextParam: number } {
    const conditions: string[] = [];
    let paramIdx = startParam;

    // Split by comma (top-level only)
    const parts = raw.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      // Format: column.operator.value  OR  relation.column.operator.value
      const segments = trimmed.split('.');

      if (segments.length === 3) {
        // Simple: column.op.value
        const [column, op, val] = segments;
        const sqlOp = this.postgrestOpToSql(op);
        values.push(val);
        conditions.push(`${column} ${sqlOp} $${paramIdx++}`);
      } else if (segments.length === 4) {
        // Embedded: relation.column.op.value
        const [relation, column, op, val] = segments;
        const fk = this.resolveFk(this._table, relation);
        if (fk) {
          // Subquery: fk_column IN (SELECT refColumn FROM refTable WHERE column op value)
          values.push(val);
          conditions.push(
            `${fk.column} IN (SELECT ${fk.refColumn} FROM ${fk.refTable} WHERE ${column} = $${paramIdx++})`
          );
        } else {
          // Fallback: treat as dotted column name
          values.push(val);
          const sqlOp = this.postgrestOpToSql(op);
          conditions.push(`"${relation}"."${column}" ${sqlOp} $${paramIdx++}`);
        }
      }
    }

    return {
      clause: conditions.length > 0 ? conditions.join(' OR ') : '',
      nextParam: paramIdx,
    };
  }

  private postgrestOpToSql(op: string): string {
    switch (op) {
      case 'eq': return '=';
      case 'neq': return '!=';
      case 'gt': return '>';
      case 'gte': return '>=';
      case 'lt': return '<';
      case 'lte': return '<=';
      default: return '=';
    }
  }

  // -------------------------------------------------------------------------
  // Embed (relation) resolution
  // -------------------------------------------------------------------------

  private resolveFk(mainTable: string, alias: string): FkDef | null {
    return FK_RELATIONS[mainTable]?.[alias] ?? null;
  }

  /**
   * Resolve embed relations by doing follow-up queries and merging results.
   */
  private async resolveEmbeds(
    rows: AnyRow[],
    mainTable: string,
    embeds: EmbedDef[]
  ): Promise<AnyRow[]> {
    for (const embed of embeds) {
      // Resolve FK for this embed
      let fk = this.resolveFk(mainTable, embed.alias);

      // Try FK hint: e.g., swap_requests_requested_by_fkey → column = requested_by
      if (!fk && embed.fkHint) {
        const hintColumn = this.parseFkHint(embed.fkHint, mainTable);
        if (hintColumn) {
          fk = { column: hintColumn, refTable: embed.table, refColumn: 'id' };
        }
      }

      // Fallback: convention-based
      if (!fk) {
        const singular = embed.table.replace(/s$/, '');
        fk = { column: `${singular}_id`, refTable: embed.table, refColumn: 'id' };
      }

      // Collect FK values from main rows
      const fkValues = [...new Set(rows.map((r) => r[fk!.column]).filter(Boolean))];

      if (fkValues.length === 0) {
        // No FK values — set embed to null on all rows
        for (const row of rows) {
          row[embed.alias] = null;
        }
        continue;
      }

      // Build the sub-query
      const colStr = embed.columns === '*' ? '*' : embed.columns;
      const placeholders = fkValues.map((_, i) => `$${i + 1}`);
      const sql = `SELECT ${colStr} FROM ${embed.table} WHERE ${fk.refColumn} IN (${placeholders.join(', ')})`;
      const result = await dbQuery(sql, fkValues);
      let relatedRows = result.rows;

      // Resolve nested embeds
      if (embed.nested.length > 0 && relatedRows.length > 0) {
        relatedRows = await this.resolveEmbeds(relatedRows, embed.table, embed.nested);
      }

      // Build lookup: refColumn value → related row
      const lookup = new Map<string, AnyRow>();
      for (const r of relatedRows) {
        lookup.set(String(r[fk!.refColumn]), r);
      }

      // Merge into main rows
      for (const row of rows) {
        const key = String(row[fk!.column]);
        row[embed.alias] = lookup.get(key) ?? null;
      }
    }

    return rows;
  }

  /**
   * Parse a FK constraint hint to extract the column name.
   * e.g., "swap_requests_requested_by_fkey" → "requested_by"
   */
  private parseFkHint(hint: string, mainTable: string): string | null {
    // Pattern: {table}_{column}_fkey
    const prefix = `${mainTable}_`;
    const suffix = '_fkey';
    if (hint.startsWith(prefix) && hint.endsWith(suffix)) {
      return hint.slice(prefix.length, -suffix.length);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// DbClient — the top-level interface
// ---------------------------------------------------------------------------

export interface DbClient {
  from<T = AnyRow>(table: string): QueryBuilder<T>;
  rpc(name: string, params: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
}

export function createDbClient(): DbClient {
  return {
    from<T = AnyRow>(table: string): QueryBuilder<T> {
      return new QueryBuilder<T>(table);
    },

    async rpc(
      name: string,
      params: Record<string, unknown>
    ): Promise<{ error: { message: string } | null }> {
      try {
        if (name === 'set_org_context') {
          await dbQuery(
            "SELECT set_config('app.current_org_id', $1, false)",
            [params.org_id]
          );
          return { error: null };
        }
        // Generic RPC: SELECT function_name(params)
        const paramKeys = Object.keys(params);
        const paramValues = Object.values(params);
        const placeholders = paramKeys.map((_, i) => `$${i + 1}`);
        const sql = `SELECT ${name}(${placeholders.join(', ')})`;
        await dbQuery(sql, paramValues);
        return { error: null };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: { message } };
      }
    },
  };
}
