export { initDatabase, getDb, getDataStore } from './connection';
export { initMetricsDatabase, getMetricsDataStore } from './metrics-db';
export type { DataStore, Dialect } from './datastore';
export type { AccountsDatabase, MetricsDatabase, Database as DbSchema } from './schema';
