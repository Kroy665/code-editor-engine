# @kroy665/code-editor-engine

> Future-proof headless code editor engine for any platform

[![npm version](https://badge.fury.io/js/%40kroy665%2Fcode-editor-engine.svg)](https://www.npmjs.com/package/@kroy665/code-editor-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A platform-agnostic, extensible code editor engine built for maximum flexibility and performance. This headless architecture provides the core logic for text editing, syntax highlighting, language services, and extension management without any UI dependencies.

Perfect for building Monaco-like editors for web, React Native, mobile apps, desktop applications, or any platform where you need professional-grade editing capabilities.

## 🎯 Key Features

### ✅ **Platform-Agnostic Design**
- Works on React Native, Web, Node.js, Electron
- Zero UI dependencies - bring your own renderer
- TypeScript-first with 100% type coverage

### ⚡ **High Performance**
- Efficient rope-like line buffer for large files (up to 100MB)
- Incremental text operations with O(log n) complexity
- Smart tokenization caching
- Sub-millisecond text operations

### 🎨 **Syntax Highlighting**
- Built-in tokenizer with state-machine architecture
- Pre-configured support for JavaScript, TypeScript, Python
- Extensible language definition system
- Regex-based pattern matching with priorities

### 🔄 **Complete Undo/Redo**
- Command pattern with full history
- Composite commands for complex operations
- Configurable stack size
- Smart command grouping with timeouts

### 🎭 **Event-Driven Architecture**
- Type-safe event emitter
- Priority-based event handling
- Async event support
- Proper disposal and memory management

### 🧩 **Extension System**
- VSCode-compatible extension API
- Activation events for lazy loading
- State management (global and workspace)
- Dependency resolution
- Extension marketplace interface

### 🌐 **Language Services Interface**
- LSP-compatible APIs
- Code completion support
- Hover information
- Diagnostics
- Go to definition
- Code actions
- Formatting
- Rename operations

### 🎯 **Bracket Matching & Auto-Closing**
- Find matching brackets (forward and backward)
- Nested bracket detection
- Surrounding bracket detection
- Auto-close brackets: `()`, `[]`, `{}`
- Auto-close quotes: `"`, `'`, `` ` ``
- Smart skip-over closing characters
- Customizable bracket pairs
- Context-aware auto-closing

## 📦 Installation

```bash
npm install @kroy665/code-editor-engine
```

Or with yarn:

```bash
yarn add @kroy665/code-editor-engine
```

Or with pnpm:

```bash
pnpm add @kroy665/code-editor-engine
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { createEditor, position } from '@kroy665/code-editor-engine';

// Create an editor with built-in language support
const { editor } = createEditor({
  languages: ['javascript', 'typescript', 'python']
});

// Open a document
await editor.openDocument(
  'file:///example.js',
  'console.log("Hello, World!");',
  'javascript'
);

// Insert text at cursor position
await editor.insertText(' // This is a comment', position(0, 29));

// Get current content
const content = editor.document?.getText();
console.log(content);
// Output: console.log("Hello, World!"); // This is a comment
```

### With Undo/Redo

```typescript
import { createEditor, position, range } from '@kroy665/code-editor-engine';

const { editor } = createEditor();

await editor.openDocument('file:///example.js', 'let x = 1;', 'javascript');

// Make some edits
await editor.insertText('\nlet y = 2;', position(1, 0));
await editor.insertText('\nlet z = 3;', position(2, 0));

console.log(editor.document?.getText());
// Output:
// let x = 1;
// let y = 2;
// let z = 3;

// Undo last two changes
await editor.undo();
await editor.undo();

console.log(editor.document?.getText());
// Output: let x = 1;

// Redo one change
await editor.redo();

console.log(editor.document?.getText());
// Output:
// let x = 1;
// let y = 2;
```

### Multiple Selections

```typescript
import { createEditor, selection } from '@kroy665/code-editor-engine';

const { editor } = createEditor();

await editor.openDocument(
  'file:///example.js',
  'const a = 1;\nconst b = 2;\nconst c = 3;',
  'javascript'
);

// Set multiple cursors
editor.setSelections([
  selection(0, 6, 0, 7), // Select 'a'
  selection(1, 6, 1, 7), // Select 'b'
  selection(2, 6, 2, 7), // Select 'c'
]);

console.log(editor.selections.length); // 3
```

### Event Handling

```typescript
import { createEditor } from '@kroy665/code-editor-engine';

const { editor } = createEditor();

// Listen to text changes
editor.on('text-changed', ({ document }) => {
  console.log('Text changed:', document.getText());
});

// Listen to cursor movement
editor.on('cursor-moved', ({ position }) => {
  console.log('Cursor moved to:', position);
});

// Listen to selection changes
editor.on('selection-changed', ({ selections }) => {
  console.log('Selections:', selections.length);
});

await editor.openDocument('file:///example.js', 'let x = 1;', 'javascript');
```

### Bracket Matching & Auto-Closing

```typescript
import { createEditor, position } from '@kroy665/code-editor-engine';

const { editor } = createEditor();
await editor.openDocument('file:///example.js', '', 'javascript');

// Auto-closing brackets
await editor.insertText('(');
console.log(editor.document?.getText()); // Output: "()"
// Cursor is automatically positioned between the brackets

// Skip over closing brackets
await editor.insertText(')');
// Cursor moves past the closing bracket instead of inserting another one

// Find matching bracket
await editor.openDocument(
  'file:///example.js',
  'function test() { return true; }',
  'javascript'
);

const match = editor.findMatchingBracket(position(0, 16)); // Position of opening {
console.log(match?.close.start); // Position of closing }

// Find surrounding brackets
const surrounding = editor.findSurroundingBrackets(position(0, 25));
console.log(surrounding); // Returns the innermost bracket pair containing the position

// Check if inside brackets
const isInside = editor.isInsideBrackets(position(0, 20));
console.log(isInside); // true

// Listen to bracket events
editor.on('bracket-matched', ({ match, position }) => {
  if (match) {
    console.log(`Bracket at ${position.line}:${position.column} matches with ${match.close.start.line}:${match.close.start.column}`);
  }
});

editor.on('auto-close-triggered', ({ openChar, closeChar, position }) => {
  console.log(`Auto-closed ${openChar}${closeChar} at ${position.line}:${position.column}`);
});
```

## 📚 Core Concepts

### 1. Document Management

```typescript
import { createEditor } from '@kroy665/code-editor-engine';

const { editor } = createEditor();

// Open a document
await editor.openDocument('file:///path/to/file.js', 'content', 'javascript');

// Access document properties
console.log(editor.document?.uri);           // file:///path/to/file.js
console.log(editor.document?.languageId);    // javascript
console.log(editor.document?.lineCount);     // number of lines
console.log(editor.document?.version);       // document version

// Get document content
const fullText = editor.document?.getText();
const lineText = editor.document?.getLineContent(0);

// Close document
editor.closeDocument();
```

### 2. Text Operations

```typescript
import { createEditor, position, range } from '@kroy665/code-editor-engine';

const { editor } = createEditor();
await editor.openDocument('file:///example.js', 'hello world', 'javascript');

// Insert text
await editor.insertText(' beautiful', position(0, 5));
// Result: "hello beautiful world"

// Delete text
await editor.deleteText(range(0, 6, 0, 16));
// Result: "hello world"

// Replace text
await editor.replaceText(range(0, 0, 0, 5), 'goodbye');
// Result: "goodbye world"
```

### 3. Command System

```typescript
import { createEditor, Command } from '@kroy665/code-editor-engine';

const { editor } = createEditor();

// Register custom command
const customCommand: Command = {
  id: 'custom.upperCase',
  label: 'Convert to Upper Case',
  execute: async () => {
    const doc = editor.document;
    if (doc) {
      const text = doc.getText();
      await editor.replaceText(
        range(0, 0, doc.lineCount - 1, doc.getLineContent(doc.lineCount - 1).length),
        text.toUpperCase()
      );
    }
  }
};

editor.registerCommand(customCommand);

// Execute command
await editor.executeCommand('custom.upperCase');

// Built-in commands
await editor.executeCommand('editor.undo');
await editor.executeCommand('editor.redo');
```

### 4. Syntax Highlighting

```typescript
import {
  createEditor,
  TokenizerLanguageService,
  BuiltInLanguages
} from '@kroy665/code-editor-engine';

const { editor } = createEditor();

// Register language service
const jsService = new TokenizerLanguageService('javascript');
editor.registerLanguageService(jsService);

// Open a JavaScript file
await editor.openDocument(
  'file:///example.js',
  'const greeting = "Hello, World!";',
  'javascript'
);

// Get tokens for syntax highlighting
const service = editor.getLanguageService('javascript');
if (service && service.tokenize) {
  const tokens = await service.tokenize(editor.document!);

  tokens.forEach(token => {
    console.log(`${token.type}: "${token.text}" at line ${token.range.start.line}`);
  });
}
```

### 5. Custom Language Definition

```typescript
import {
  createEditor,
  Tokenizer,
  TokenType,
  LanguageDefinition
} from '@kroy665/code-editor-engine';

// Define a custom language
const customLanguage: LanguageDefinition = {
  languageId: 'mylang',
  name: 'My Custom Language',
  extensions: ['.mylang'],
  defaultState: 'root',
  keywords: ['let', 'const', 'if', 'else', 'function'],
  states: {
    root: [
      // Comments
      { pattern: /\/\/.*$/gm, type: TokenType.Comment },

      // Strings
      { pattern: /"([^"\\]|\\.)*"/g, type: TokenType.String },

      // Numbers
      { pattern: /\b\d+\.?\d*\b/g, type: TokenType.Number },

      // Identifiers
      { pattern: /[a-zA-Z_][a-zA-Z0-9_]*/g, type: TokenType.Identifier },

      // Operators
      { pattern: /[+\-*/%=<>!&|^~?:]+/g, type: TokenType.Operator },
    ]
  }
};

const tokenizer = new Tokenizer();
tokenizer.registerLanguage(customLanguage);
```

### 6. Extension Development

```typescript
import { Extension, ExtensionContext } from '@kroy665/code-editor-engine';

// Create a custom extension
const myExtension: Extension = {
  id: 'my-extension',
  name: 'My Extension',
  version: '1.0.0',
  description: 'My awesome extension',
  activationEvents: ['onLanguage:javascript'],

  async activate(context: ExtensionContext) {
    console.log('Extension activated!');

    // Register commands
    const command = {
      id: 'myext.hello',
      label: 'Say Hello',
      execute: () => console.log('Hello from extension!')
    };

    context.registerCommand('myext.hello', command);

    // Use state storage
    await context.globalState.update('lastActivated', Date.now());
  },

  async deactivate() {
    console.log('Extension deactivated');
  }
};

// Use the extension
const { editor, extensionHost } = createEditor({
  extensions: [myExtension]
});

// Activate the extension
await extensionHost.activateByEvent('onLanguage:javascript');
```

### 7. Language Service Provider

```typescript
import {
  LanguageService,
  CompletionItem,
  CompletionItemKind,
  Position,
  TextDocument
} from '@kroy665/code-editor-engine';

// Create a custom language service
class MyLanguageService implements LanguageService {
  languageId = 'javascript';

  async provideCompletions(
    document: TextDocument,
    position: Position
  ): Promise<CompletionItem[]> {
    return [
      {
        label: 'console',
        kind: CompletionItemKind.Variable,
        detail: 'Console object',
        insertText: 'console',
        documentation: 'The console object provides access to debugging console'
      },
      {
        label: 'log',
        kind: CompletionItemKind.Method,
        detail: '(method) log(...data: any[]): void',
        insertText: 'log',
        documentation: 'Outputs a message to the console'
      }
    ];
  }

  async provideHover(document: TextDocument, position: Position) {
    const word = document.getWordRangeAtPosition(position);
    if (!word) return null;

    const text = document.getText(word);

    return {
      contents: [`**${text}**`, 'Variable declaration'],
      range: word
    };
  }
}

const { editor } = createEditor();
editor.registerLanguageService(new MyLanguageService());
```

### 8. Builder Pattern

```typescript
import { editor } from '@kroy665/code-editor-engine';

// Use the fluent builder API
const myEditor = editor()
  .withTabSize(2)
  .withSpaces(true)
  .readOnly(false)
  .withLanguageService(myLanguageService)
  .withCommand(myCommand)
  .build();

await myEditor.openDocument('file:///example.js', 'code', 'javascript');
```

### 9. Working with LineBuffer Directly

```typescript
import { LineBuffer, position, range } from '@kroy665/code-editor-engine';

// Create a line buffer for efficient text manipulation
const buffer = new LineBuffer('Hello\nWorld\n!');

console.log(buffer.lineCount);          // 3
console.log(buffer.getLineContent(0));  // "Hello"
console.log(buffer.getText());          // "Hello\nWorld\n!"

// Insert text
buffer.insertText(position(0, 5), ' there');
console.log(buffer.getLineContent(0));  // "Hello there"

// Delete text
buffer.deleteText(range(0, 6, 0, 11));
console.log(buffer.getLineContent(0));  // "Hello "

// Find text
const match = buffer.findNext('World', position(0, 0));
console.log(match);  // { start: { line: 1, column: 0 }, end: { line: 1, column: 5 } }

// Find all occurrences
const matches = buffer.findAll('l', { caseSensitive: true });
console.log(matches.length);  // Number of 'l' characters
```

### 10. Event System Features

```typescript
import { TypedEventEmitter, PriorityEventEmitter } from '@kroy665/code-editor-engine';

// Priority-based events
type MyEvents = {
  'data-changed': { value: number };
};

const emitter = new PriorityEventEmitter<MyEvents>();

// High priority listener (executes first)
emitter.onWithPriority('data-changed', (data) => {
  console.log('High priority:', data.value);
}, 100);

// Normal priority listener
emitter.on('data-changed', (data) => {
  console.log('Normal priority:', data.value);
});

// Low priority listener
emitter.onWithPriority('data-changed', (data) => {
  console.log('Low priority:', data.value);
}, -100);

emitter.emit('data-changed', { value: 42 });
// Output:
// High priority: 42
// Normal priority: 42
// Low priority: 42
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Your UI Layer                       │
│          (React, React Native, Vue, etc.)               │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Events & Commands
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Code Editor Engine                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │          Extension System                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │Extension │ │Extension │ │Extension │        │   │
│  │  │    1     │ │    2     │ │    3     │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘        │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Language Services                        │   │
│  │  - Tokenization    - Completion                 │   │
│  │  - Diagnostics     - Hover                      │   │
│  │  - Formatting      - Code Actions               │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Core Editor                            │   │
│  │  - Document Management                          │   │
│  │  - Text Operations                              │   │
│  │  - Selection Management                         │   │
│  │  - Event System                                 │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Command System                           │   │
│  │  - Command Registry                             │   │
│  │  - Undo/Redo Stack                              │   │
│  │  - Command Grouping                             │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │          Text Buffer                             │   │
│  │  - LineBuffer (Rope-like structure)             │   │
│  │  - Efficient insertions/deletions               │   │
│  │  - Position/Range operations                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 📖 API Reference

### Main Entry Points

#### `createEditor(options?): { editor, extensionHost }`
Creates a complete editor instance with extensions.

**Options:**
- `editorOptions?: Partial<EditorOptions>` - Editor configuration
- `languages?: string[]` - Languages to enable (`'javascript'`, `'typescript'`, `'python'`)
- `extensions?: Extension[]` - Custom extensions to load
- `builtInExtensions?: boolean` - Load built-in extensions (default: `true`)

#### `createMinimalEditor(options?): CodeEditor`
Creates a minimal editor without extensions.

#### Helper Functions

```typescript
// Position helpers
position(line: number, column: number): Position

// Range helpers
range(
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number
): Range

// Selection helpers
selection(
  anchorLine: number,
  anchorColumn: number,
  activeLine: number,
  activeColumn: number
): Selection
```

### Editor Options

```typescript
interface EditorOptions {
  tabSize: number;              // Default: 4
  insertSpaces: boolean;        // Default: true
  autoIndent: boolean;          // Default: true
  wordWrap: boolean;            // Default: false
  lineNumbers: boolean;         // Default: true
  readOnly: boolean;            // Default: false
  undoStackSize: number;        // Default: 1000
}
```

### Events

```typescript
interface EditorEvents {
  'text-changed': { changes: TextChange[]; document: TextDocument };
  'selection-changed': { selections: Selection[]; document: TextDocument };
  'cursor-moved': { position: Position; document: TextDocument };
  'language-changed': { languageId: string; document: TextDocument };
  'document-opened': { document: TextDocument };
  'document-closed': { uri: string };
  'document-saved': { document: TextDocument };
  'undo': { command: Command };
  'redo': { command: Command };
}
```

### Token Types

```typescript
enum TokenType {
  Text = 'text',
  Keyword = 'keyword',
  String = 'string',
  Comment = 'comment',
  Number = 'number',
  Operator = 'operator',
  Identifier = 'identifier',
  Type = 'type',
  Function = 'function',
  Variable = 'variable',
  Property = 'property',
  Class = 'class',
  // ... and more
}
```

## 🎨 Use Cases

### React Native Mobile App

```typescript
import { createEditor } from '@kroy665/code-editor-engine';
import { View, Text, TextInput } from 'react-native';

function CodeEditorScreen() {
  const [editor] = useState(() => createEditor({ languages: ['javascript'] }).editor);
  const [content, setContent] = useState('');

  useEffect(() => {
    editor.on('text-changed', ({ document }) => {
      setContent(document.getText());
    });

    editor.openDocument('file:///temp.js', '', 'javascript');
  }, []);

  const handleTextChange = async (text: string) => {
    if (editor.document) {
      await editor.replaceText(
        range(0, 0, editor.document.lineCount - 1, 999),
        text
      );
    }
  };

  return (
    <View>
      <TextInput
        multiline
        value={content}
        onChangeText={handleTextChange}
        style={{ fontFamily: 'monospace' }}
      />
    </View>
  );
}
```

### Web-based Code Editor

```typescript
import { createEditor } from '@kroy665/code-editor-engine';

class WebEditor {
  private editor = createEditor({ languages: ['typescript'] }).editor;
  private editorElement: HTMLTextAreaElement;

  constructor(element: HTMLTextAreaElement) {
    this.editorElement = element;
    this.setupEventListeners();
  }

  private async setupEventListeners() {
    await this.editor.openDocument('file:///untitled.ts', '', 'typescript');

    this.editorElement.addEventListener('input', async (e) => {
      const target = e.target as HTMLTextAreaElement;
      if (this.editor.document) {
        await this.editor.replaceText(
          range(0, 0, this.editor.document.lineCount - 1, 999),
          target.value
        );
      }
    });

    this.editor.on('text-changed', ({ document }) => {
      this.editorElement.value = document.getText();
    });
  }

  async undo() {
    await this.editor.undo();
  }

  async redo() {
    await this.editor.redo();
  }
}
```

### Node.js CLI Tool

```typescript
import { createEditor } from '@kroy665/code-editor-engine';
import * as fs from 'fs';

async function editFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { editor } = createEditor({ languages: ['javascript'] });

  await editor.openDocument(`file:///${filePath}`, content, 'javascript');

  // Perform automated edits
  await editor.insertText('\n// Auto-generated comment', position(0, 0));

  // Get language service for syntax checking
  const service = editor.getLanguageService('javascript');
  if (service?.tokenize) {
    const tokens = await service.tokenize(editor.document!);
    console.log(`Found ${tokens.length} tokens`);
  }

  // Save back to file
  const newContent = editor.document?.getText();
  if (newContent) {
    fs.writeFileSync(filePath, newContent);
  }
}
```

## 🔧 Advanced Topics

### Memory Management

```typescript
import { createEditor } from '@kroy665/code-editor-engine';

const { editor, extensionHost } = createEditor();

// ... use editor ...

// Proper cleanup
editor.dispose();          // Dispose editor and free resources
extensionHost.dispose();   // Dispose all extensions

// Check if disposed
console.log(editor.disposed);  // true
```

### Custom Command with Undo/Redo

```typescript
import { UndoableCommand, CommandContext } from '@kroy665/code-editor-engine';

class UpperCaseCommand extends UndoableCommand {
  private previousText: string = '';
  private range: Range;

  constructor(private context: CommandContext, range: Range) {
    super('custom.uppercase', 'Convert to Upper Case');
    this.range = range;
  }

  execute() {
    const document = this.context.document;
    this.previousText = document.getText(this.range);

    const buffer = (document as any).getBuffer();
    buffer.replaceText(this.range, this.previousText.toUpperCase());

    this.markExecuted();
  }

  undo() {
    if (!this.executed) return;

    const document = this.context.document;
    const buffer = (document as any).getBuffer();
    buffer.replaceText(this.range, this.previousText);

    this.markUndone();
  }
}
```

### Performance Monitoring

```typescript
import { Performance, Memory, Debug } from '@kroy665/code-editor-engine';

// Measure operation performance
const result = await Performance.measure('insertText', async () => {
  await editor.insertText('large text content', position(0, 0));
});

// Profile synchronous operations
const { result: tokens, time } = Performance.profile(() => {
  return tokenizer.tokenize(document);
});
console.log(`Tokenization took ${time.toFixed(2)}ms`);

// Check memory usage (Node.js only)
const usage = Memory.getUsage();
if (usage) {
  console.log('Heap used:', (usage.heapUsed / 1024 / 1024).toFixed(2), 'MB');
}

// Debug logging (only in development)
Debug.log('Editor initialized');
Debug.warn('Large file detected');
Debug.error('Failed to save');
```

### Platform Detection

```typescript
import { Platform } from '@kroy665/code-editor-engine';

if (Platform.isReactNative()) {
  console.log('Running in React Native');
} else if (Platform.isBrowser()) {
  console.log('Running in browser');
} else if (Platform.isNode()) {
  console.log('Running in Node.js');
}
```

## 🧪 Testing

```typescript
import { createEditor, position } from '@kroy665/code-editor-engine';

describe('CodeEditor', () => {
  let editor: CodeEditor;

  beforeEach(() => {
    editor = createEditor().editor;
  });

  afterEach(() => {
    editor.dispose();
  });

  test('should insert text correctly', async () => {
    await editor.openDocument('test.js', 'hello', 'javascript');
    await editor.insertText(' world', position(0, 5));

    expect(editor.document?.getText()).toBe('hello world');
  });

  test('should support undo/redo', async () => {
    await editor.openDocument('test.js', 'original', 'javascript');
    await editor.insertText(' modified', position(0, 8));

    expect(editor.document?.getText()).toBe('original modified');

    await editor.undo();
    expect(editor.document?.getText()).toBe('original');

    await editor.redo();
    expect(editor.document?.getText()).toBe('original modified');
  });
});
```

## 📊 Performance Benchmarks

- **Insert Operation**: < 1ms for typical edits
- **Delete Operation**: < 1ms for typical edits
- **Undo/Redo**: < 1ms per operation
- **Tokenization**: ~10-50ms for 1000 lines (cached)
- **Memory**: ~1-5MB per 10,000 lines of code

## 🗺️ Roadmap

- [x] **Bracket matching and auto-closing** ✅ v1.1.0
- [ ] Advanced find/replace with regex
- [ ] LSP client integration
- [ ] Virtual scrolling for huge files
- [ ] Incremental parsing for better performance
- [ ] Tree-sitter grammar support
- [ ] Code folding support
- [ ] Multi-threaded tokenization with Web Workers
- [ ] Minimap support
- [ ] Collaborative editing (CRDT)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © Koushik Roy

## 🔗 Links

- [GitHub Repository](https://github.com/Kroy665/code-editor-engine)
- [npm Package](https://www.npmjs.com/package/@kroy665/code-editor-engine)
- [Issue Tracker](https://github.com/Kroy665/code-editor-engine/issues)

## 💡 Support

If you have questions or need help, please:
- Open an issue on GitHub
- Check the examples in the `/examples` directory
- Review the TypeScript definitions for detailed API documentation

---

**Built with ❤️ for developers who need a powerful, flexible code editing engine**
