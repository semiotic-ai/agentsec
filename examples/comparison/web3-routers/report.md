# Web3 Router Comparison

Generated: 2026-05-28T16:16:21.516Z

Every router skill is audited with the AST-10 Web3 Annex rules forced on
(`--profile web3`) so coverage is identical across rows. Rows are sorted by
score (highest first).

## Summary

| Skill | Score | Grade | Findings |
| --- | ---: | :-: | ---: |
| Odos | 88 | B | 4 |
| SushiSwap | 71 | C | 5 |
| CowSwap | 70 | C | 4 |
| Across | 49 | D | 8 |
| deBridge | 49 | D | 9 |
| KyberSwap | 49 | D | 29 |
| PancakeSwap | 49 | D | 13 |
| Uniswap | 49 | D | 12 |
| 0x | 48 | D | 9 |
| LI.FI | 45 | D | 8 |
| 1inch | 26 | F | 135 |

## Rule matrix

Cells show the worst severity flagged for each rule, with finding count.
Empty cells mean no finding for that rule.

| Rule | Odos | SushiSwap | CowSwap | Across | deBridge | KyberSwap | PancakeSwap | Uniswap | 0x | LI.FI | 1inch |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `AST-W01` |  |  |  | 🟠 high (1) |  | 🟠 high (1) | 🟠 high (2) | 🟠 high (2) | 🟠 high (1) |  | 🟡 medium (1) |
| `AST-W02` |  |  | 🟡 medium (1) |  |  |  |  | 🟡 medium (1) | 🔴 critical (3) | 🔴 critical (1) |  |
| `AST-W05` |  |  |  |  |  | 🟢 low (20) | 🟢 low (5) |  |  |  | 🟢 low (6) |
| `AST-W07` |  |  |  | 🟡 medium (1) | 🟠 high (4) |  |  | 🟡 medium (2) |  | 🟡 medium (2) | 🟡 medium (1) |
| `AST-W08` |  |  |  |  |  |  |  |  |  |  | 🟠 high (85) |
| `AST-W10` |  |  |  |  |  |  |  | 🟠 high (1) |  |  | 🟡 medium (1) |
| `AST-W11` |  |  | 🟠 high (1) |  |  |  | 🟠 high (2) | 🟠 high (1) |  |  | 🟠 high (1) |
| `AST-W12` | 🟢 low (3) |  |  | 🟡 medium (1) | 🟠 high (1) | 🟡 medium (2) | 🟡 medium (1) | 🟡 medium (1) | 🟡 medium (1) |  | 🟠 high (4) |
| `AST01` |  |  |  |  |  | 🟠 high (1) |  |  |  |  |  |
| `AST03` |  |  |  |  |  |  |  |  |  |  | 🟡 medium (14) |
| `AST04` | 🟢 low (1) | 🟡 medium (4) | 🟡 medium (1) | 🟡 medium (4) | 🟡 medium (3) | 🟡 medium (4) | 🟡 medium (2) | 🟡 medium (3) | 🟡 medium (3) | 🟡 medium (4) | 🟠 high (5) |
| `AST05` |  | 🟡 medium (1) | 🟡 medium (1) | 🟡 medium (1) | 🟡 medium (1) | 🟡 medium (1) | 🟡 medium (1) | 🟡 medium (1) | 🟡 medium (1) | 🟡 medium (1) | 🟡 medium (1) |
| `AST06` |  |  |  |  |  |  |  |  |  |  | 🟢 low (13) |
| `AST08` |  |  |  |  |  |  |  |  |  |  | 🟡 medium (1) |
| `AST09` |  |  |  |  |  |  |  |  |  |  | 🟡 medium (2) |

## Legend

- 🔴 critical
- 🟠 high
- 🟡 medium
- 🟢 low
- ⚪ info

