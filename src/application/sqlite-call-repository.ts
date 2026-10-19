import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { CallState } from "../domain/call-state.js";
import { CallIdConflictError } from "./call-repository.js";
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
    `);
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

  async save(call: CallRecord): Promise<void> {
    this.saveRecord(call);
  }

  private saveRecord(call: CallRecord): void {
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
          provider_call_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          contact_external_id = excluded.contact_external_id,
          campaign_external_id = excluded.campaign_external_id,
          consent_confirmed = excluded.consent_confirmed,
          do_not_call = excluded.do_not_call,
          within_calling_window = excluded.within_calling_window,
          state = excluded.state,
          provider_call_id = excluded.provider_call_id
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
      );
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CallRecord | undefined> {
    return this.findByKey(idempotencyKey);
  }

  private findByKey(idempotencyKey: string): CallRecord | undefined {
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
      // DatabaseSync transactions must not yield to another request on this connection.
      const existing = this.findByKey(idempotencyKey);

      if (existing) {
        this.db.exec("COMMIT");
        return existing;
      }

      if (this.db.prepare("SELECT id FROM calls WHERE id = ?").get(call.id)) {
        throw new CallIdConflictError();
      }
      this.saveRecord(call);

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
    };
  }
}
