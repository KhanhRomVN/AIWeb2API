import * as fs from 'fs';
import { createLogger } from '../../utils/logger';
import { PoWChallenge, PoWResponse } from './deepseek.types';

const logger = createLogger('DeepSeekPoW');

// =============================================================================
// CONSTANTS
// =============================================================================

export const BASE_URL = 'https://chat.deepseek.com';

// =============================================================================
// POW HASH (WASM)
// =============================================================================

export class DeepSeekHash {
  private instance: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private wasmPath: string;

  constructor(wasmPath: string) {
    this.wasmPath = wasmPath;
  }

  async init() {
    if (this.instance) return;
    try {
      if (!fs.existsSync(this.wasmPath)) {
        throw new Error(`WASM file not found at ${this.wasmPath}`);
      }
      const wasmBuffer = fs.readFileSync(this.wasmPath);
      const wasmModule = new WebAssembly.Module(wasmBuffer);
      const instance = new WebAssembly.Instance(wasmModule, {
        wasi_snapshot_preview1: {
          fd_write: () => 0,
          environ_sizes_get: () => 0,
          environ_get: () => 0,
          clock_time_get: () => 0,
          fd_close: () => 0,
          fd_seek: () => 0,
          fd_fdstat_get: () => 0,
          proc_exit: () => 0,
        },
        env: {},
      });
      this.instance = instance;
      this.memory = instance.exports.memory as WebAssembly.Memory;
    } catch (e) {
      logger.error('Failed to initialize DeepSeek WASM:', e);
      throw e;
    }
  }

  private writeToMemory(text: string): [number, number] {
    if (!this.instance || !this.memory) throw new Error('WASM not initialized');
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    const length = encoded.length;
    const malloc = this.instance.exports
      .__wbindgen_export_0 as CallableFunction;
    const ptr = malloc(length, 1) as number;
    const memoryView = new Uint8Array(this.memory.buffer);
    memoryView.set(encoded, ptr);
    return [ptr, length];
  }

  calculateHash(
    difficulty: number,
    challenge: string,
    prefix: string,
  ): number | null {
    if (!this.instance || !this.memory) throw new Error('WASM not initialized');
    const stackPointerFn = this.instance.exports
      .__wbindgen_add_to_stack_pointer as CallableFunction;
    const solveFn = this.instance.exports.wasm_solve as CallableFunction;
    const retptr = stackPointerFn(-16) as number;
    try {
      const [cPtr, cLen] = this.writeToMemory(challenge);
      const [pPtr, pLen] = this.writeToMemory(prefix);
      solveFn(retptr, cPtr, cLen, pPtr, pLen, difficulty);
      const memoryView = new DataView(this.memory.buffer);
      const status = memoryView.getInt32(retptr, true);
      if (status === 0) return null;
      return Number(memoryView.getFloat64(retptr + 8, true));
    } finally {
      stackPointerFn(16);
    }
  }
}

// =============================================================================
// PoW SOLVER
// =============================================================================

export async function solvePoW(
  dsHash: DeepSeekHash,
  challenge: PoWChallenge,
): Promise<PoWResponse> {
  const prefix = `${challenge.salt}_${challenge.expire_at}_`;
  const answer = dsHash.calculateHash(
    challenge.difficulty,
    challenge.challenge,
    prefix,
  );

  return {
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    salt: challenge.salt,
    answer: answer !== null ? answer : 0,
    signature: challenge.signature,
    target_path: challenge.target_path,
  };
}