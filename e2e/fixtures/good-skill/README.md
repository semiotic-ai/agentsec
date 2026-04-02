# code-formatter

A code formatting skill for OpenClaw that supports TypeScript, Python, and JSON.

## Usage

Provide source code and optional style configuration. The skill will detect the language automatically or use the specified language hint.

### Inputs

| Parameter  | Type     | Required | Description                     |
|-----------|----------|----------|---------------------------------|
| `code`    | string   | yes      | The source code to format       |
| `language`| string   | no       | Language hint (auto-detected)   |
| `style`   | object   | no       | Formatting style overrides      |

### Style Options

- `indentSize` (number, default: 2) - Spaces per indent level
- `useTabs` (boolean, default: false) - Use tabs instead of spaces
- `maxLineLength` (number, default: 80) - Maximum line width before wrapping
- `trailingComma` (boolean, default: true) - Add trailing commas in TS/JSON

### Outputs

- `formatted` (string) - The formatted source code
- `changes` (number) - Count of lines that were modified

## Permissions

This skill requires only clipboard access for copy/paste integration:
- `clipboard:read`
- `clipboard:write`

## Development

```bash
npm install
npm test
```

## License

MIT
