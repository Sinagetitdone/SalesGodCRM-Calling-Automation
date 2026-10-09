import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { CallOutcome } from "../domain/call-outcome.js";
import type { CallState } from "../domain/call-state.js";
import type {
  CallRecord,
  CallRepository,
} from "./call-repository.js";

interface CallRow {
  id: string;
  contact_external_id: string;
  campaign_external_id: string;
  consent_confirmed: number;
  do_not_call: number;
  within_calling_window: number;
  state: CallState;
  provider_call_id: string | null;
  outcome: CallOutcome | null;
}

export class SQLiteCallRepository implements CallRepository {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), {
      recursive: true,
    });

    this.db = new DatabaseSync(databasePath);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        contact_external_id TEXT NOT NULL,
        campaign_external_id TEXT NOT NULL,
        consent_confirmed INTEGER NOT NULL,
        do_not_call INTEGER NOT NULL,
        within_calling_window INTEGER NOT NULL,
        state TEXT NOT NULL,
        provider_call_id TEXT
      );

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        idempotency_key TEXT PRIMARY KEY,
        call_id TEXT NOT NULL,
        FOREIGN KEY (call_id) REFERENCES calls(id)
      );

      CREATE TABLE IF NOT EXISTS do_not_call (
        phone_number TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Databases created before outcomes existed need the column added.
    const columns = this.db
      .prepare("PRAGMA table_info(calls)")
      .all() as unknown as { name: string }[];

    if (!columns.some((column) => column.name === "outcome")) {
      this.db.exec("ALTER TABLE calls ADD COLUMN outcome TEXT");
    }
  }

  async getSetting(key: string): Promise<string | undefined> {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | undefined;

    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      .run(key, value);
  }

  async listDoNotCall(): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT phone_number FROM do_not_call ORDER BY phone_number")
      .all() as unknown as { phone_number: string }[];

    return rows.map((row) => row.phone_number);
  }

  async addDoNotCall(phoneNumber: string): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO do_not_call (phone_number)
        VALUES (?)
        ON CONFLICT(phone_number) DO NOTHING
      `)
      .run(phoneNumber);
  }

  async get(id: string): Promise<CallRecord | undefined> {
    const row = this.db
      .prepare(`
        SELECT *
        FROM calls
        WHERE id = ?
      `)
      .get(id) as CallRow | undefined;

    return row ? this.toCallRecord(row) : undefined;
  }

  async list(): Promise<CallRecord[]> {
    const rows = this.db
      .prepare(`
        SELECT *
        FROM calls
        ORDER BY rowid
      `)
      .all() as unknown as CallRow[];

    return rows.map((row) => this.toCallRecord(row));
  }

  async save(call: CallRecord): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO calls (
          id,
          contact_external_id,
          campaign_external_id,
          consent_confirmed,
          do_not_call,
          within_calling_window,
          state,
          provider_call_id,
          outcome
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          contact_external_id = excluded.contact_external_id,
          campaign_external_id = excluded.campaign_external_id,
          consent_confirmed = excluded.consent_confirmed,
          do_not_call = excluded.do_not_call,
          within_calling_window = excluded.within_calling_window,
          state = excluded.state,
          provider_call_id = excluded.provider_call_id,
          outcome = excluded.outcome
      `)
      .run(
        call.id,
        call.contactExternalId,
        call.campaignExternalId,
        call.consentConfirmed ? 1 : 0,
        call.doNotCall ? 1 : 0,
        call.withinCallingWindow ? 1 : 0,
        call.state,
        call.providerCallId ?? null,
        call.outcome ?? null,
      );
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CallRecord | undefined> {
    const row = this.db
      .prepare(`
        SELECT calls.*
        FROM idempotency_keys
        JOIN calls
          ON calls.id = idempotency_keys.call_id
        WHERE idempotency_keys.idempotency_key = ?
      `)
      .get(idempotencyKey) as CallRow | undefined;

    return row ? this.toCallRecord(row) : undefined;
  }

  async saveIfIdempotencyKeyAbsent(
    idempotencyKey: string,
    call: CallRecord,
  ): Promise<CallRecord | undefined> {
    this.db.exec("BEGIN IMMEDIATE");

    try {
      const existing =
        await this.findByIdempotencyKey(idempotencyKey);

      if (existing) {
        this.db.exec("COMMIT");
        return existing;
      }

      await this.save(call);

      this.db
        .prepare(`
          INSERT INTO idempotency_keys (
            idempotency_key,
            call_id
          )
          VALUES (?, ?)
        `)
        .run(
          idempotencyKey,
          call.id,
        );

      this.db.exec("COMMIT");

      return undefined;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  private toCallRecord(row: CallRow): CallRecord {
    return {
      id: row.id,
      contactExternalId: row.contact_external_id,
      campaignExternalId: row.campaign_external_id,
      consentConfirmed: row.consent_confirmed === 1,
      doNotCall: row.do_not_call === 1,
      withinCallingWindow: row.within_calling_window === 1,
      state: row.state,
      ...(row.provider_call_id
        ? { providerCallId: row.provider_call_id }
        : {}),
      ...(row.outcome ? { outcome: row.outcome } : {}),
    };
  }
}