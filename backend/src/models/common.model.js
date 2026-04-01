const pool = require("../config/db");

const SLOW_QUERY_MS = 300;

/**
 * Execute a SELECT query — returns array of rows.
 */
async function query(sql, values = []) {
  const start = Date.now();
  const [rows] = await pool.execute(sql, values);
  const ms = Date.now() - start;
  if (ms > SLOW_QUERY_MS) {
    console.warn(`[SLOW QUERY ${ms}ms] ${sql.slice(0, 120)}`);
  }
  return rows;
}

/**
 * Execute an INSERT/UPDATE/DELETE — returns the full ResultSetHeader.
 * Use result.insertId, result.affectedRows, result.changedRows.
 */
async function execute(sql, values = []) {
  const start = Date.now();
  const [result] = await pool.execute(sql, values);
  const ms = Date.now() - start;
  if (ms > SLOW_QUERY_MS) {
    console.warn(`[SLOW QUERY ${ms}ms] ${sql.slice(0, 120)}`);
  }
  return result;
}

/**
 * Run multiple statements inside a single transaction.
 * Pass an async callback that receives { query, execute } bound to the connection.
 */
async function transaction(callback) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback({
      query: async (sql, values = []) => {
        const [rows] = await conn.execute(sql, values);
        return rows;
      },
      execute: async (sql, values = []) => {
        const [res] = await conn.execute(sql, values);
        return res;
      },
    });
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { query, execute, transaction };