[![tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/c/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Rizal556z/tiny-stack-vm-01-run-20261122/rank.svg)](https://make.fun/c/tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Rizal556z/tiny-stack-vm-01-run-20261122/reward.svg)](https://make.fun/c/tiny-stack-vm-01-run-20261122)

# Tiny Stack VM

A tiny stack virtual machine for make.fun's tiny-stack-vm-01: 32-bit wrapping
integers, a 256-value stack, calls, 256 words of memory, input/output, and the
ISA's ten traps with their exact exit codes.

Run: `node main.ts` — reads `/input/<id>/program.bin` + `input.bin`, writes
`/output/<id>/stdout.bin` + `exit.txt`. Env overrides: `MAKEFUN_INPUT_DIR`,
`MAKEFUN_OUTPUT_DIR`. Deterministic; one 60s run answers all 40 instances.
