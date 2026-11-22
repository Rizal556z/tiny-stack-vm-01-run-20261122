// Tiny stack VM for make.fun tiny-stack-vm-01. ISA: kit program/generator/subject/ISA.md.
// Node 22 (erasable TS; plain JS here). One run answers all 40 instances under
// /input/<id>/, writing /output/<id>/stdout.bin + exit.txt. Env overrides
// MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR, like the starter. Fully deterministic.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const enc = new TextEncoder();

// Opcode table: immBytes | pops<<3 | pushes<<6; 255 = not an opcode.
const T = new Uint8Array(256).fill(255);
const S = (a, v) => { for (const o of a) T[o] = v; };
S([0, 52], 0); // HALT, RET
S([1], 65); // PUSH8: imm 1, push 1
S([2], 68); // PUSH32: imm 4, push 1
S([3], 8); // POP
S([4], 136); // DUP
S([5], 144); // SWAP
S([6], 208); // OVER
S([7], 216); // ROT
S([16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 34], 80); // binary ops
S([23, 27], 72); // NEG, NOT
S([48, 51], 2); // JMP, CALL: imm 2
S([49, 50], 10); // JZ, JNZ: imm 2, pop 1
S([64], 72); // LOAD
S([65], 16); // STORE
S([80, 81, 83], 8); // PRINT, PUTC, EXIT
S([82], 64); // IN

// Runs one program on its input bytes; returns [stdout bytes, exit code].
function run(prog, inp) {
  const n = prog.length;
  const D = new Int32Array(256); // data stack
  let sp = 0;
  const C = new Int32Array(64); // call stack
  let cp = 0;
  const M = new Int32Array(256); // memory, all zero
  const out = new Uint8Array(65536);
  let ol = 0, ip = 0, pc = 0, steps = 0;
  const end = (c) => [out.subarray(0, ol), c];
  for (;;) {
    if (steps === 1000000) return end(10); // step limit
    if (pc < 0 || pc >= n) return end(9); // pc outside program
    const op = prog[pc], t = T[op];
    if (t === 255) return end(5); // unknown opcode
    const imm = t & 7, pops = (t >> 3) & 3, push = t >> 6;
    if (pc + imm >= n) return end(9); // immediate cut off
    steps++;
    pc += 1 + imm; // past the instruction
    if (sp < pops) return end(2); // stack underflow
    if (sp - pops + push > 256) return end(3); // stack overflow
    switch (op) {
      case 0: return end(0); // HALT
      case 1: D[sp++] = (prog[pc - 1] << 24) >> 24; break; // PUSH8, sign-extended
      case 2: // PUSH32, little-endian
        D[sp++] = prog[pc - 4] | (prog[pc - 3] << 8) | (prog[pc - 2] << 16) | (prog[pc - 1] << 24);
        break;
      case 3: sp--; break; // POP
      case 4: D[sp] = D[sp - 1]; sp++; break; // DUP
      case 5: { const x = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = x; break; } // SWAP
      case 6: D[sp] = D[sp - 2]; sp++; break; // OVER
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; } // ROT
      case 23: D[sp - 1] = (-D[sp - 1]) | 0; break; // NEG (wraps)
      case 27: D[sp - 1] = ~D[sp - 1]; break; // NOT
      case 48: case 49: case 50: { // JMP JZ JNZ
        const rel = ((prog[pc - 2] | (prog[pc - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) { const v = D[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc += rel;
        break;
      }
      case 51: // CALL
        if (cp === 64) return end(7);
        C[cp++] = pc;
        pc = prog[pc - 2] | (prog[pc - 1] << 8);
        break;
      case 52: // RET
        if (cp === 0) return end(8);
        pc = C[--cp];
        break;
      case 64: { // LOAD
        const a = D[sp - 1];
        if (a < 0 || a >= 256) return end(6);
        D[sp - 1] = M[a];
        break;
      }
      case 65: { // STORE (v addr --)
        const a = D[sp - 1], v = D[sp - 2];
        if (a < 0 || a >= 256) return end(6);
        sp -= 2;
        M[a] = v;
        break;
      }
      case 80: { // PRINT: decimal, no newline
        const s = String(D[sp - 1]);
        if (ol + s.length > 65536) return end(11);
        sp--;
        enc.encodeInto(s, out.subarray(ol));
        ol += s.length;
        break;
      }
      case 81: // PUTC: low byte
        if (ol + 1 > 65536) return end(11);
        out[ol++] = D[--sp] & 255;
        break;
      case 82: D[sp++] = ip < inp.length ? inp[ip++] : -1; break; // IN
      case 83: return end(D[--sp] & 255); // EXIT: low byte
      default: { // two-operand ops
        const b = D[sp - 1], a = D[sp - 2];
        let r;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { // DIV: truncate toward zero
          if (b === 0) return end(4);
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 20) { // MOD: sign of a
          if (b === 0) return end(4);
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 21) { // DIVU
          if (b === 0) return end(4);
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 22) { // MODU
          if (b === 0) return end(4);
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0; // LTU
        sp -= 2;
        D[sp++] = r;
        break;
      }
    }
  }
}

for (const id of readdirSync(I).sort()) {
  const [stdout, exit] = run(
    readFileSync(join(I, id, 'program.bin')),
    readFileSync(join(I, id, 'input.bin')),
  );
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), stdout);
  writeFileSync(join(O, id, 'exit.txt'), String(exit) + '\n');
}
