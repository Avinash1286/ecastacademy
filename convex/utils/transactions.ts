/**
 * Transaction Utilities for Convex
 * 
 * Provides patterns for atomic operations in Convex mutations.
 * 
 * Note: Convex mutations are already atomic at the database level.
 * This module provides helper patterns for:
 * 1. Collecting all changes before applying them
 * 2. Validation before mutation
 * 3. Rollback-safe patterns
 * 4. Batch operations with consistency checks
 */

import { MutationCtx } from "../_generated/server";
import { Id, Doc, TableNames } from "../_generated/dataModel";

/**
 * Represents a pending database operation
 */
export type PendingOperation<T extends TableNames = TableNames> =
  | { type: "insert"; table: T; data: Omit<Doc<T>, "_id" | "_creationTime"> }
  | { type: "patch"; table: T; id: Id<T>; data: Partial<Doc<T>> }
  | { type: "delete"; table: T; id: Id<T> };

/**
 * Transaction builder for collecting and executing operations atomically
 * 
 * Usage:
 * ```typescript
 * const tx = createTransaction();
 * tx.insert("courses", { name: "Test", ... });
 * tx.patch("chapters", chapterId, { order: 1 });
 * tx.delete("contentItems", itemId);
 * 
 * // Validate before committing
 * if (someValidationFails) {
 *   throw new Error("Validation failed");
 * }
 * 
 * // Execute all operations
 * await tx.commit(ctx);
 * ```
 */
export function createTransaction() {
  const operations: PendingOperation[] = [];
  const insertedIds: Map<number, Id<TableNames>> = new Map();

  return {
    /**
     * Queue an insert operation
     */
    insert<T extends TableNames>(
      table: T,
      data: Omit<Doc<T>, "_id" | "_creationTime">
    ): number {
      const index = operations.length;
      operations.push({ type: "insert", table, data: data as Omit<Doc<TableNames>, "_id" | "_creationTime"> });
      return index; // Return index for referencing inserted ID later
    },

    /**
     * Queue a patch operation
     */
    patch<T extends TableNames>(
      table: T,
      id: Id<T>,
      data: Partial<Doc<T>>
    ): void {
      operations.push({ type: "patch", table, id: id as Id<TableNames>, data: data as Partial<Doc<TableNames>> });
    },

    /**
     * Queue a delete operation
     */
    delete<T extends TableNames>(table: T, id: Id<T>): void {
      operations.push({ type: "delete", table, id: id as Id<TableNames> });
    },

    /**
     * Get the number of pending operations
     */
    get pendingCount(): number {
      return operations.length;
    },

    /**
     * Clear all pending operations (rollback)
     */
    rollback(): void {
      operations.length = 0;
      insertedIds.clear();
    },

    /**
     * Execute all pending operations
     * Returns a map of insert indices to their new IDs
     */
    async commit(ctx: MutationCtx): Promise<Map<number, Id<TableNames>>> {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];

        switch (op.type) {
          case "insert": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id = await ctx.db.insert(op.table as any, op.data as any);
            insertedIds.set(i, id);
            break;
          }
          case "patch": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await ctx.db.patch(op.id as any, op.data as any);
            break;
          }
          case "delete": {
            await ctx.db.delete(op.id);
            break;
          }
        }
      }

      // Clear operations after successful commit
      operations.length = 0;
      const result = new Map(insertedIds);
      insertedIds.clear();

      return result;
    },

    /**
     * Get inserted ID by operation index (only available after commit)
     */
    getInsertedId(index: number): Id<TableNames> | undefined {
      return insertedIds.get(index);
    },
  };
}

/**
 * Type for the transaction object
 */
export type Transaction = ReturnType<typeof createTransaction>;

/**
 * Execute a function with automatic rollback on error
 * 
 * Note: Since Convex mutations are atomic, if an error is thrown,
 * no changes are persisted. This helper ensures proper cleanup
 * of the transaction builder state.
 */
export async function withTransaction<T>(
  ctx: MutationCtx,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  const tx = createTransaction();
  
  try {
    const result = await fn(tx);
    await tx.commit(ctx);
    return result;
  } catch (error) {
    tx.rollback();
    throw error;
  }
}

/**
 * Validate all preconditions before executing mutations
 * Throws an error if any validation fails
 */
export async function validatePreconditions(
  validations: Array<{
    check: () => Promise<boolean> | boolean;
    errorMessage: string;
  }>
): Promise<void> {
  for (const { check, errorMessage } of validations) {
    const isValid = await check();
    if (!isValid) {
      throw new Error(errorMessage);
    }
  }
}

/**
 * Batch update helper - updates multiple records with consistent error handling
 */
export async function batchUpdate<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  updates: Array<{ id: Id<T>; data: Partial<Doc<T>> }>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const { id, data } of updates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.db.patch(id as any, data as any);
      success++;
    } catch (error) {
      console.error(`Failed to update ${table} ${id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Batch delete helper - deletes multiple records with consistent error handling
 */
export async function batchDelete<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  ids: Id<T>[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      await ctx.db.delete(id);
      success++;
    } catch (error) {
      console.error(`Failed to delete ${table} ${id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Optimistic locking helper - ensures document hasn't changed since read
 */
export async function withOptimisticLock<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  id: Id<T>,
  expectedVersion: number,
  update: Partial<Doc<T>> & { version: number }
): Promise<boolean> {
  const current = await ctx.db.get(id);
  
  if (!current) {
    throw new Error(`Document ${id} not found`);
  }

  // Check if document has a version field and if it matches
  const currentVersion = (current as { version?: number }).version ?? 0;
  
  if (currentVersion !== expectedVersion) {
    return false; // Document was modified by another transaction
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await ctx.db.patch(id as any, update as any);
  return true;
}
