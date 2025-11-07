import { Token, TokenType, Range, TextDocument, LanguageService } from '../types/core.js';

/**
 * Token with additional metadata for highlighting
 */
export interface EnhancedToken extends Token {
    readonly priority: number; // Higher priority tokens override lower ones
    readonly scopes: string[]; // Semantic scopes for theming
}

/**
 * Tokenization rule
 */
export interface TokenRule {
    readonly pattern: RegExp;
    readonly type: TokenType;
    readonly priority?: number;
    readonly scopes?: string[];
    readonly push?: string; // State to push
    readonly pop?: boolean; // Pop current state
    readonly set?: string; // Set state
}

/**
 * Language tokenization definition
 */
export interface LanguageDefinition {
    readonly languageId: string;
    readonly name: string;
    readonly extensions: string[];
    readonly states: Record<string, TokenRule[]>;
    readonly defaultState: string;
    readonly brackets?: BracketDefinition[];
    readonly comments?: CommentDefinition;
    readonly strings?: StringDefinition[];
    readonly keywords?: string[];
    readonly builtins?: string[];
    readonly operators?: string[];
}

export interface BracketDefinition {
    readonly open: string;
    readonly close: string;
    readonly type?: 'round' | 'square' | 'curly' | 'angle';
}

export interface CommentDefinition {
    readonly line?: string; // Single line comment
    readonly block?: { start: string; end: string }; // Block comment
}

export interface StringDefinition {
    readonly delimiter: string;
    readonly escape?: string;
    readonly multiline?: boolean;
    readonly raw?: boolean;
}

/**
 * Tokenizer state
 */
interface TokenizerState {
    readonly name: string;
    readonly line: number;
    readonly column: number;
    readonly index: number;
}

/**
 * Fast, incremental tokenizer
 */
export class Tokenizer {
    private readonly languageDefinitions = new Map<string, LanguageDefinition>();
    private readonly tokenCache = new Map<string, EnhancedToken[]>();
    private readonly stateStack: TokenizerState[] = [];

    /**
     * Register a language definition
     */
    registerLanguage(definition: LanguageDefinition): void {
        this.languageDefinitions.set(definition.languageId, definition);

        // Clear cache for this language
        this.clearCacheForLanguage(definition.languageId);
    }

    /**
     * Get language definition
     */
    getLanguage(languageId: string): LanguageDefinition | undefined {
        return this.languageDefinitions.get(languageId);
    }

    /**
     * Tokenize a document
     */
    tokenize(document: TextDocument, range?: Range): EnhancedToken[] {
        const language = this.languageDefinitions.get(document.languageId);
        if (!language) {
            return this.tokenizeAsPlainText(document, range);
        }

        const cacheKey = this.getCacheKey(document, range);
        const cached = this.tokenCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const tokens = this.tokenizeWithLanguage(document, language, range);
        this.tokenCache.set(cacheKey, tokens);

        return tokens;
    }

    /**
     * Tokenize incrementally after a change
     */
    tokenizeIncremental(
        document: TextDocument,
        _previousTokens: EnhancedToken[],
        _change: { range: Range; text: string },
    ): EnhancedToken[] {
        // For now, just re-tokenize the entire document
        // In production, you'd implement smart incremental tokenization
        this.clearCacheForDocument(document.uri);
        return this.tokenize(document);
    }

    private tokenizeWithLanguage(
        document: TextDocument,
        language: LanguageDefinition,
        range?: Range,
    ): EnhancedToken[] {
        const tokens: EnhancedToken[] = [];
        const text = range ? document.getText(range) : document.getText();
        const startLine = range?.start.line || 0;
        const startColumn = range?.start.column || 0;

        let currentState = language.defaultState;
        let line = startLine;
        let column = startColumn;

        const lines = text.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const lineText = lines[lineIndex];
            column = lineIndex === 0 ? startColumn : 0;

            const lineTokens = this.tokenizeLine(lineText, language, currentState, line, column);

            tokens.push(...lineTokens);
            line++;
        }

        return tokens;
    }

    private tokenizeLine(
        lineText: string,
        language: LanguageDefinition,
        initialState: string,
        line: number,
        startColumn: number,
    ): EnhancedToken[] {
        const tokens: EnhancedToken[] = [];

        let column = startColumn;
        let index = 0;
        let currentState = initialState;

        while (index < lineText.length) {
            let matched = false;
            const remainingText = lineText.substring(index);
            const currentRules = language.states[currentState] || [];

            // Try each rule in the current state
            for (const rule of currentRules) {
                const match = rule.pattern.exec(remainingText);

                if (match && match.index === 0) {
                    const matchText = match[0];
                    const tokenType = this.resolveTokenType(matchText, rule.type, language);

                    tokens.push({
                        type: tokenType,
                        range: {
                            start: { line, column },
                            end: { line, column: column + matchText.length },
                        },
                        text: matchText,
                        priority: rule.priority || 0,
                        scopes: rule.scopes || [tokenType],
                        modifiers: this.getTokenModifiers(matchText, tokenType, language),
                    });

                    // Handle state changes
                    if (rule.push) {
                        this.stateStack.push({
                            name: currentState,
                            line,
                            column,
                            index,
                        });
                        currentState = rule.push;
                    } else if (rule.pop && this.stateStack.length > 0) {
                        const prevState = this.stateStack.pop();
                        currentState = prevState?.name || language.defaultState;
                    } else if (rule.set) {
                        currentState = rule.set;
                    }

                    column += matchText.length;
                    index += matchText.length;
                    matched = true;

                    // Reset regex state
                    rule.pattern.lastIndex = 0;
                    break;
                }

                // Reset regex state
                rule.pattern.lastIndex = 0;
            }

            if (!matched) {
                // No rule matched, advance by one character
                const char = lineText[index];
                tokens.push({
                    type: TokenType.Text,
                    range: {
                        start: { line, column },
                        end: { line, column: column + 1 },
                    },
                    text: char,
                    priority: -1,
                    scopes: [TokenType.Text],
                    modifiers: [],
                });

                column++;
                index++;
            }
        }

        return tokens;
    }

    private resolveTokenType(
        text: string,
        baseType: TokenType,
        language: LanguageDefinition,
    ): TokenType {
        // Check if it's a keyword
        if (baseType === TokenType.Identifier && language.keywords?.includes(text)) {
            return TokenType.Keyword;
        }

        // Check if it's a builtin
        if (baseType === TokenType.Identifier && language.builtins?.includes(text)) {
            return TokenType.Function; // Or a new TokenType.Builtin
        }

        // Check if it's an operator
        if (language.operators?.includes(text)) {
            return TokenType.Operator;
        }

        return baseType;
    }

    private getTokenModifiers(
        text: string,
        type: TokenType,
        _language: LanguageDefinition,
    ): string[] {
        const modifiers: string[] = [];

        // Add common modifiers based on token characteristics
        if (type === TokenType.Identifier) {
            if (text[0] === text[0].toUpperCase()) {
                modifiers.push('capitalized');
            }
            if (text.includes('_')) {
                modifiers.push('snake_case');
            }
            if (/^[A-Z_]+$/.test(text)) {
                modifiers.push('constant');
            }
        }

        return modifiers;
    }

    private tokenizeAsPlainText(document: TextDocument, range?: Range): EnhancedToken[] {
        const text = range ? document.getText(range) : document.getText();
        const startLine = range?.start.line || 0;
        const startColumn = range?.start.column || 0;

        return [
            {
                type: TokenType.Text,
                range: {
                    start: { line: startLine, column: startColumn },
                    end: { line: startLine, column: startColumn + text.length },
                },
                text,
                priority: 0,
                scopes: [TokenType.Text],
                modifiers: [],
            },
        ];
    }

    private getCacheKey(document: TextDocument, range?: Range): string {
        const rangeKey = range
            ? `${range.start.line},${range.start.column}-${range.end.line},${range.end.column}`
            : 'full';
        return `${document.uri}:${document.version}:${rangeKey}`;
    }

    private clearCacheForLanguage(_languageId: string): void {
        // In a real implementation, you'd associate cache keys with languages
        // For now, just clear everything
        this.tokenCache.clear();
    }

    private clearCacheForDocument(uri: string): void {
        for (const [key, _] of this.tokenCache) {
            if (key.startsWith(uri + ':')) {
                this.tokenCache.delete(key);
            }
        }
    }
}

/**
 * Built-in language definitions
 */
export class BuiltInLanguages {
    static javascript(): LanguageDefinition {
        return {
            languageId: 'javascript',
            name: 'JavaScript',
            extensions: ['.js', '.mjs', '.jsx'],
            defaultState: 'root',
            keywords: [
                'break',
                'case',
                'catch',
                'class',
                'const',
                'continue',
                'debugger',
                'default',
                'delete',
                'do',
                'else',
                'export',
                'extends',
                'finally',
                'for',
                'function',
                'if',
                'import',
                'in',
                'instanceof',
                'let',
                'new',
                'return',
                'super',
                'switch',
                'this',
                'throw',
                'try',
                'typeof',
                'var',
                'void',
                'while',
                'with',
                'yield',
                'async',
                'await',
            ],
            builtins: [
                'console',
                'window',
                'document',
                'Array',
                'Object',
                'String',
                'Number',
                'Boolean',
                'Function',
                'RegExp',
                'Date',
                'Math',
                'JSON',
                'Promise',
                'Set',
                'Map',
                'WeakSet',
                'WeakMap',
            ],
            operators: [
                '+',
                '-',
                '*',
                '/',
                '%',
                '++',
                '--',
                '=',
                '+=',
                '-=',
                '*=',
                '/=',
                '%=',
                '==',
                '!=',
                '===',
                '!==',
                '<',
                '>',
                '<=',
                '>=',
                '&&',
                '||',
                '!',
                '&',
                '|',
                '^',
                '~',
                '<<',
                '>>',
                '>>>',
                '?',
                ':',
                '=>',
            ],
            states: {
                root: [
                    // Comments
                    { pattern: /\/\/.*$/gm, type: TokenType.Comment },
                    { pattern: /\/\*/, type: TokenType.Comment, push: 'blockComment' },

                    // Strings
                    { pattern: /"([^"\\]|\\.)*"/g, type: TokenType.String },
                    { pattern: /'([^'\\]|\\.)*'/g, type: TokenType.String },
                    { pattern: /`/, type: TokenType.String, push: 'templateString' },

                    // Numbers
                    { pattern: /\b\d+\.?\d*([eE][+-]?\d+)?\b/g, type: TokenType.Number },
                    { pattern: /\b0[xX][0-9a-fA-F]+\b/g, type: TokenType.Number },
                    { pattern: /\b0[bB][01]+\b/g, type: TokenType.Number },
                    { pattern: /\b0[oO][0-7]+\b/g, type: TokenType.Number },

                    // Identifiers (will be checked against keywords/builtins)
                    { pattern: /[a-zA-Z_$][a-zA-Z0-9_$]*/g, type: TokenType.Identifier },

                    // Operators and punctuation
                    { pattern: /[+\-*/%=<>!&|^~?:]+/g, type: TokenType.Operator },
                    { pattern: /[{}()[\];,\.]/g, type: TokenType.Operator },

                    // Whitespace
                    { pattern: /\s+/g, type: TokenType.Text },
                ],
                blockComment: [
                    { pattern: /\*\//, type: TokenType.Comment, pop: true },
                    { pattern: /./, type: TokenType.Comment },
                ],
                templateString: [
                    { pattern: /`/, type: TokenType.String, pop: true },
                    { pattern: /\$\{/, type: TokenType.Operator, push: 'templateExpression' },
                    { pattern: /[^`$]+/, type: TokenType.String },
                    { pattern: /\$/, type: TokenType.String },
                ],
                templateExpression: [
                    { pattern: /\}/, type: TokenType.Operator, pop: true },
                    // Include root rules for expressions
                    { pattern: /[a-zA-Z_$][a-zA-Z0-9_$]*/, type: TokenType.Identifier },
                    { pattern: /[+\-*/%=<>!&|^~?:]+/, type: TokenType.Operator },
                    { pattern: /\d+/, type: TokenType.Number },
                    { pattern: /\s+/, type: TokenType.Text },
                ],
            },
            brackets: [
                { open: '(', close: ')', type: 'round' },
                { open: '[', close: ']', type: 'square' },
                { open: '{', close: '}', type: 'curly' },
                { open: '<', close: '>', type: 'angle' },
            ],
            comments: {
                line: '//',
                block: { start: '/*', end: '*/' },
            },
            strings: [
                { delimiter: '"', escape: '\\' },
                { delimiter: "'", escape: '\\' },
                { delimiter: '`', escape: '\\', multiline: true },
            ],
        };
    }

    static typescript(): LanguageDefinition {
        const jsDefinition = this.javascript();
        return {
            ...jsDefinition,
            languageId: 'typescript',
            name: 'TypeScript',
            extensions: ['.ts', '.tsx'],
            keywords: [
                ...jsDefinition.keywords!,
                'interface',
                'type',
                'namespace',
                'module',
                'declare',
                'abstract',
                'implements',
                'private',
                'protected',
                'public',
                'readonly',
                'static',
                'as',
                'is',
                'keyof',
                'unique',
                'infer',
                'never',
                'unknown',
                'any',
            ],
        };
    }

    static python(): LanguageDefinition {
        return {
            languageId: 'python',
            name: 'Python',
            extensions: ['.py', '.pyw', '.pyi'],
            defaultState: 'root',
            keywords: [
                'False',
                'None',
                'True',
                'and',
                'as',
                'assert',
                'async',
                'await',
                'break',
                'class',
                'continue',
                'def',
                'del',
                'elif',
                'else',
                'except',
                'finally',
                'for',
                'from',
                'global',
                'if',
                'import',
                'in',
                'is',
                'lambda',
                'nonlocal',
                'not',
                'or',
                'pass',
                'raise',
                'return',
                'try',
                'while',
                'with',
                'yield',
            ],
            builtins: [
                'abs',
                'all',
                'any',
                'bin',
                'bool',
                'bytes',
                'callable',
                'chr',
                'classmethod',
                'compile',
                'complex',
                'delattr',
                'dict',
                'dir',
                'divmod',
                'enumerate',
                'eval',
                'exec',
                'filter',
                'float',
                'format',
                'frozenset',
                'getattr',
                'globals',
                'hasattr',
                'hash',
                'help',
                'hex',
                'id',
                'input',
                'int',
                'isinstance',
                'issubclass',
                'iter',
                'len',
                'list',
                'locals',
                'map',
                'max',
                'memoryview',
                'min',
                'next',
                'object',
                'oct',
                'open',
                'ord',
                'pow',
                'print',
                'property',
                'range',
                'repr',
                'reversed',
                'round',
                'set',
                'setattr',
                'slice',
                'sorted',
                'staticmethod',
                'str',
                'sum',
                'super',
                'tuple',
                'type',
                'vars',
                'zip',
            ],
            operators: [
                '+',
                '-',
                '*',
                '/',
                '//',
                '%',
                '**',
                '=',
                '+=',
                '-=',
                '*=',
                '/=',
                '//=',
                '%=',
                '**=',
                '==',
                '!=',
                '<',
                '>',
                '<=',
                '>=',
                'and',
                'or',
                'not',
                '&',
                '|',
                '^',
                '~',
                '<<',
                '>>',
                '&=',
                '|=',
                '^=',
                '<<=',
                '>>=',
                'is',
                'is not',
                'in',
                'not in',
            ],
            states: {
                root: [
                    // Comments
                    { pattern: /#.*$/gm, type: TokenType.Comment },

                    // Strings
                    { pattern: /"""/, type: TokenType.String, push: 'tripleDoubleString' },
                    { pattern: /'''/, type: TokenType.String, push: 'tripleSingleString' },
                    { pattern: /"([^"\\]|\\.)*"/g, type: TokenType.String },
                    { pattern: /'([^'\\]|\\.)*'/g, type: TokenType.String },
                    { pattern: /r"[^"]*"/g, type: TokenType.String },
                    { pattern: /r'[^']*'/g, type: TokenType.String },

                    // Numbers
                    { pattern: /\b\d+\.?\d*([eE][+-]?\d+)?[jJ]?\b/g, type: TokenType.Number },
                    { pattern: /\b0[xX][0-9a-fA-F]+\b/g, type: TokenType.Number },
                    { pattern: /\b0[bB][01]+\b/g, type: TokenType.Number },
                    { pattern: /\b0[oO][0-7]+\b/g, type: TokenType.Number },

                    // Identifiers
                    { pattern: /[a-zA-Z_][a-zA-Z0-9_]*/g, type: TokenType.Identifier },

                    // Operators and punctuation
                    { pattern: /[+\-*/%=<>!&|^~]+/g, type: TokenType.Operator },
                    { pattern: /[{}()[\];,\.]/g, type: TokenType.Operator },

                    // Whitespace
                    { pattern: /\s+/g, type: TokenType.Text },
                ],
                tripleDoubleString: [
                    { pattern: /"""/, type: TokenType.String, pop: true },
                    { pattern: /./, type: TokenType.String },
                ],
                tripleSingleString: [
                    { pattern: /'''/, type: TokenType.String, pop: true },
                    { pattern: /./, type: TokenType.String },
                ],
            },
            brackets: [
                { open: '(', close: ')', type: 'round' },
                { open: '[', close: ']', type: 'square' },
                { open: '{', close: '}', type: 'curly' },
            ],
            comments: {
                line: '#',
            },
            strings: [
                { delimiter: '"', escape: '\\' },
                { delimiter: "'", escape: '\\' },
                { delimiter: '"""', escape: '\\', multiline: true },
                { delimiter: "'''", escape: '\\', multiline: true },
            ],
        };
    }
}

/**
 * Language service that provides tokenization
 */
export class TokenizerLanguageService implements LanguageService {
    private tokenizer = new Tokenizer();

    constructor(public readonly languageId: string) {
        // Register built-in languages
        this.tokenizer.registerLanguage(BuiltInLanguages.javascript());
        this.tokenizer.registerLanguage(BuiltInLanguages.typescript());
        this.tokenizer.registerLanguage(BuiltInLanguages.python());
    }

    async tokenize(document: TextDocument, range?: Range): Promise<Token[]> {
        return this.tokenizer.tokenize(document, range);
    }

    registerLanguage(definition: LanguageDefinition): void {
        this.tokenizer.registerLanguage(definition);
    }
}
