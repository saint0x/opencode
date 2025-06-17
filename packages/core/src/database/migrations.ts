import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import { 
  Result, 
  ok, 
  err, 
  ErrorCode, 
  databaseError,
  type OpenCodeError 
} from '@opencode/types'
import type { OpenCodeDatabase } from './client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface Migration {
  version: number
  name: string
  up: string
  down?: string
  checksum: string
}

export interface MigrationRecord {
  version: number
  name: string
  applied_at: string
  checksum: string
}

export class MigrationManager {
  constructor(private db: OpenCodeDatabase) {}

  /**
   * Load all migration files from the migrations directory
   */
  private loadMigrations(): Result<Migration[], OpenCodeError> {
    try {
      const migrationsDir = join(__dirname, 'migrations')
      const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
      
      const migrations: Migration[] = []
      
      for (const file of files) {
        const match = file.match(/^(\d+)_(.+)\.sql$/)
        if (!match) continue
        
        const version = parseInt(match[1], 10)
        const name = match[2].replace(/_/g, ' ')
        const content = readFileSync(join(migrationsDir, file), 'utf-8')
        
        // Calculate checksum
        const checksum = createHash('sha256').update(content).digest('hex')
        
        migrations.push({
          version,
          name,
          up: content,
          checksum
        })
      }
      
      // Sort by version
      migrations.sort((a, b) => a.version - b.version)
      
      return ok(migrations)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_MIGRATION,
        'Failed to load migration files',
        error as Error
      ))
    }
  }

  /**
   * Get applied migrations from database
   */
  private getAppliedMigrations(): Result<MigrationRecord[], OpenCodeError> {
    try {
      const stmt = this.db['db'].prepare(`
        SELECT version, name, applied_at, checksum 
        FROM migrations 
        ORDER BY version ASC
      `)
      
      const results = stmt.all() as MigrationRecord[]
      return ok(results)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_QUERY,
        'Failed to get applied migrations',
        error as Error
      ))
    }
  }

  /**
   * Record a migration as applied
   */
  private recordMigration(migration: Migration): Result<void, OpenCodeError> {
    try {
      const stmt = this.db['db'].prepare(`
        INSERT INTO migrations (version, name, checksum)
        VALUES (?, ?, ?)
      `)
      
      stmt.run(migration.version, migration.name, migration.checksum)
      return ok(undefined)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_QUERY,
        'Failed to record migration',
        error as Error
      ))
    }
  }

  /**
   * Check migration status
   */
  async getMigrationStatus(): Promise<Result<{
    pending: Migration[],
    applied: MigrationRecord[],
    conflicts: { migration: Migration, record: MigrationRecord }[]
  }, OpenCodeError>> {
    const migrationsResult = this.loadMigrations()
    if (!migrationsResult.success) {
      return err(migrationsResult.error)
    }

    const appliedResult = this.getAppliedMigrations()
    if (!appliedResult.success) {
      return err(appliedResult.error)
    }

    const migrations = migrationsResult.data
    const applied = appliedResult.data

    const appliedVersions = new Set(applied.map(m => m.version))
    const pending = migrations.filter(m => !appliedVersions.has(m.version))

    // Check for checksum conflicts
    const conflicts: Array<{ migration: Migration; record: MigrationRecord }> = []
    for (const migration of migrations) {
      const record = applied.find(a => a.version === migration.version)
      if (record && record.checksum !== migration.checksum) {
        conflicts.push({ migration, record })
      }
    }

    return ok({ pending, applied, conflicts })
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<Result<{ applied: Migration[] }, OpenCodeError>> {
    const statusResult = await this.getMigrationStatus()
    if (!statusResult.success) {
      return err(statusResult.error)
    }

    const { pending, conflicts } = statusResult.data

    if (conflicts.length > 0) {
      return err(databaseError(
        ErrorCode.DATABASE_MIGRATION,
        `Migration conflicts detected: ${conflicts.map(c => c.migration.name).join(', ')}`
      ))
    }

    const applied: Migration[] = []

    try {
      for (const migration of pending) {
        // Run migration in transaction
        const transaction = this.db['db'].transaction(() => {
          // Execute migration SQL
          this.db['db'].exec(migration.up)
          
          // Record migration
          const recordResult = this.recordMigration(migration)
          if (!recordResult.success) {
            throw recordResult.error
          }
        })

        transaction()
        applied.push(migration)
      }

      return ok({ applied })
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_MIGRATION,
        'Migration failed',
        error as Error
      ))
    }
  }

  /**
   * Create a new migration file
   */
  static createMigration(name: string, content: string): Result<string, OpenCodeError> {
    try {
      const timestamp = Date.now()
      const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`
      const migrationsDir = join(__dirname, 'migrations')
      const filepath = join(migrationsDir, filename)

      // Ensure migrations directory exists
      try {
        readdirSync(migrationsDir)
      } catch {
        require('fs').mkdirSync(migrationsDir, { recursive: true })
      }

      require('fs').writeFileSync(filepath, content, 'utf-8')
      
      return ok(filepath)
    } catch (error) {
      return err(databaseError(
        ErrorCode.DATABASE_MIGRATION,
        'Failed to create migration file',
        error as Error
      ))
    }
  }
} 