/**
 * Core Types for Headless Code Editor Engine
 * Future-proof, platform-agnostic type definitions
 */

// ================================
// POSITION & RANGE TYPES
// ================================

export interface Position {
    readonly line: number; // 0-based
    readonly column: number; // 0-based
}

export interface Range {
    readonly start: Position;
    readonly end: Position;
}

export interface Selection extends Range {
    readonly anchor: Position; // Where selection started
    readonly active: Position; // Current cursor position
    readonly isReversed: boolean; // True if active < anchor
}

// ================================
// TEXT OPERATIONS
// ================================

export interface TextChange {
    readonly range: Range;
    readonly text: string;
    readonly rangeLength?: number; // For optimization
}

export interface TextDocument {
    readonly uri: string;
    readonly languageId: string;
    readonly version: number;
    readonly lineCount: number;
    getText(range?: Range): string;
    getLineContent(line: number): string;
    getWordRangeAtPosition(position: Position): Range | null;
    validateRange(range: Range): Range;
    validatePosition(position: Position): Position;
}

// ================================
// COMMAND SYSTEM
// ================================

export interface Command {
    readonly id: string;
    readonly label: string;
    execute(...args: any[]): Promise<any> | any;
    undo?(): Promise<void> | void;
    redo?(): Promise<void> | void;
}

export interface CommandContext {
    readonly editor: CodeEditor;
    readonly document: TextDocument;
    readonly selections: readonly Selection[];
}

// ================================
// EVENT SYSTEM
// ================================

export type EventListener<T = any> = (event: T) => void;

export interface EventEmitter<TEvents = Record<string, any>> {
    on<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): Disposable;
    off<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): void;
    emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void;
    once<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): Disposable;
}

export interface Disposable {
    dispose(): void;
}

// ================================
// EDITOR EVENTS
// ================================

export interface EditorEvents {
    'text-changed': { changes: TextChange[]; document: TextDocument };
    'selection-changed': { selections: Selection[]; document: TextDocument };
    'cursor-moved': { position: Position; document: TextDocument };
    'language-changed': { languageId: string; document: TextDocument };
    'document-opened': { document: TextDocument };
    'document-closed': { uri: string };
    'document-saved': { document: TextDocument };
    undo: { command: Command };
    redo: { command: Command };
}

// ================================
// LANGUAGE FEATURES
// ================================

export enum TokenType {
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
    Interface = 'interface',
    Enum = 'enum',
    Namespace = 'namespace',
    Parameter = 'parameter',
    TypeParameter = 'typeParameter',
    Decorator = 'decorator',
    Macro = 'macro',
    Regexp = 'regexp',
}

export interface Token {
    readonly type: TokenType;
    readonly range: Range;
    readonly text: string;
    readonly modifiers?: string[]; // e.g., ['deprecated', 'readonly']
}

export interface CompletionItem {
    readonly label: string;
    readonly kind: CompletionItemKind;
    readonly detail?: string;
    readonly documentation?: string;
    readonly insertText: string;
    readonly range?: Range;
    readonly sortText?: string;
    readonly filterText?: string;
    readonly additionalTextEdits?: TextChange[];
}

export enum CompletionItemKind {
    Text = 'text',
    Method = 'method',
    Function = 'function',
    Constructor = 'constructor',
    Field = 'field',
    Variable = 'variable',
    Class = 'class',
    Interface = 'interface',
    Module = 'module',
    Property = 'property',
    Unit = 'unit',
    Value = 'value',
    Enum = 'enum',
    Keyword = 'keyword',
    Snippet = 'snippet',
    Color = 'color',
    File = 'file',
    Reference = 'reference',
    Folder = 'folder',
    EnumMember = 'enumMember',
    Constant = 'constant',
    Struct = 'struct',
    Event = 'event',
    Operator = 'operator',
    TypeParameter = 'typeParameter',
}

export interface Diagnostic {
    readonly range: Range;
    readonly message: string;
    readonly severity: DiagnosticSeverity;
    readonly code?: string | number;
    readonly source?: string;
    readonly relatedInformation?: DiagnosticRelatedInformation[];
}

export enum DiagnosticSeverity {
    Error = 'error',
    Warning = 'warning',
    Information = 'information',
    Hint = 'hint',
}

export interface DiagnosticRelatedInformation {
    readonly location: { uri: string; range: Range };
    readonly message: string;
}

// ================================
// LANGUAGE SERVICE
// ================================

export interface LanguageService {
    readonly languageId: string;

    // Tokenization
    tokenize?(document: TextDocument, range?: Range): Promise<Token[]>;

    // Code completion
    provideCompletions?(
        document: TextDocument,
        position: Position,
        context?: CompletionContext,
    ): Promise<CompletionItem[]>;

    // Hover information
    provideHover?(document: TextDocument, position: Position): Promise<Hover | null>;

    // Diagnostics
    provideDiagnostics?(document: TextDocument): Promise<Diagnostic[]>;

    // Definition
    provideDefinition?(document: TextDocument, position: Position): Promise<Location[]>;

    // Code actions
    provideCodeActions?(
        document: TextDocument,
        range: Range,
        context: CodeActionContext,
    ): Promise<CodeAction[]>;

    // Formatting
    provideDocumentFormattingEdits?(
        document: TextDocument,
        options: FormattingOptions,
    ): Promise<TextChange[]>;

    // Rename
    provideRenameEdits?(
        document: TextDocument,
        position: Position,
        newName: string,
    ): Promise<WorkspaceEdit | null>;
}

export interface CompletionContext {
    readonly triggerKind: CompletionTriggerKind;
    readonly triggerCharacter?: string;
}

export enum CompletionTriggerKind {
    Invoked = 'invoked',
    TriggerCharacter = 'triggerCharacter',
    TriggerForIncompleteCompletions = 'triggerForIncompleteCompletions',
}

export interface Hover {
    readonly contents: string[];
    readonly range?: Range;
}

export interface Location {
    readonly uri: string;
    readonly range: Range;
}

export interface CodeAction {
    readonly title: string;
    readonly kind?: CodeActionKind;
    readonly diagnostics?: Diagnostic[];
    readonly edit?: WorkspaceEdit;
    readonly command?: Command;
    readonly isPreferred?: boolean;
}

export enum CodeActionKind {
    QuickFix = 'quickfix',
    Refactor = 'refactor',
    RefactorExtract = 'refactor.extract',
    RefactorInline = 'refactor.inline',
    RefactorRewrite = 'refactor.rewrite',
    Source = 'source',
    SourceOrganizeImports = 'source.organizeImports',
    SourceFixAll = 'source.fixAll',
}

export interface CodeActionContext {
    readonly diagnostics: Diagnostic[];
    readonly only?: CodeActionKind[];
}

export interface WorkspaceEdit {
    readonly changes?: { [uri: string]: TextChange[] };
}

export interface FormattingOptions {
    readonly tabSize: number;
    readonly insertSpaces: boolean;
    readonly trimTrailingWhitespace?: boolean;
    readonly insertFinalNewline?: boolean;
    readonly trimFinalNewlines?: boolean;
}

// ================================
// EDITOR INTERFACE
// ================================

export interface EditorOptions {
    readonly tabSize: number;
    readonly insertSpaces: boolean;
    readonly autoIndent: boolean;
    readonly wordWrap: boolean;
    readonly lineNumbers: boolean;
    readonly readOnly: boolean;
    readonly undoStackSize: number;
}

export interface CodeEditor extends EventEmitter<EditorEvents> {
    // Document management
    readonly document: TextDocument | null;
    openDocument(uri: string, content: string, languageId: string): Promise<void>;
    closeDocument(): void;
    saveDocument(): Promise<void>;

    // Selections and cursor
    readonly selections: readonly Selection[];
    setSelections(selections: Selection[]): void;

    // Text operations
    insertText(text: string, position?: Position): Promise<void>;
    deleteText(range: Range): Promise<void>;
    replaceText(range: Range, text: string): Promise<void>;

    // Commands
    executeCommand(commandId: string, ...args: any[]): Promise<any>;
    registerCommand(command: Command): Disposable;

    // Language services
    registerLanguageService(service: LanguageService): Disposable;
    getLanguageService(languageId: string): LanguageService | null;

    // History
    undo(): Promise<void>;
    redo(): Promise<void>;
    canUndo(): boolean;
    canRedo(): boolean;

    // Configuration
    updateOptions(options: Partial<EditorOptions>): void;
    getOptions(): EditorOptions;

    // Utility
    dispose(): void;
}

// ================================
// EXTENSION SYSTEM
// ================================

export interface Extension {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly description?: string;
    readonly activationEvents?: string[];

    activate(context: ExtensionContext): Promise<void> | void;
    deactivate?(): Promise<void> | void;
}

export interface ExtensionContext {
    readonly extensionId: string;
    readonly globalState: Memento;
    readonly workspaceState: Memento;

    registerCommand(commandId: string, command: Command): Disposable;
    registerLanguageService(service: LanguageService): Disposable;
    registerTextDocumentProvider(scheme: string, provider: TextDocumentProvider): Disposable;
}

export interface Memento {
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    update(key: string, value: any): Promise<void>;
    keys(): readonly string[];
}

export interface TextDocumentProvider {
    provideTextDocumentContent(uri: string): Promise<string>;
    onDidChange?: EventEmitter<string>['emit'];
}

// ================================
// CONFIGURATION
// ================================

export interface ConfigurationTarget {
    readonly global: 'global';
    readonly workspace: 'workspace';
    readonly workspaceFolder: 'workspaceFolder';
}

export interface Configuration {
    get<T>(section: string): T | undefined;
    get<T>(section: string, defaultValue: T): T;
    has(section: string): boolean;
    inspect<T>(section: string): ConfigurationInspectResult<T> | undefined;
    update(section: string, value: any, target?: keyof ConfigurationTarget): Promise<void>;
}

export interface ConfigurationInspectResult<T> {
    readonly key: string;
    readonly defaultValue?: T;
    readonly globalValue?: T;
    readonly workspaceValue?: T;
    readonly workspaceFolderValue?: T;
}

// ================================
// FILE SYSTEM
// ================================

export interface FileSystemProvider {
    readFile(uri: string): Promise<Uint8Array>;
    writeFile(uri: string, content: Uint8Array): Promise<void>;
    delete(uri: string): Promise<void>;
    rename(oldUri: string, newUri: string): Promise<void>;
    exists(uri: string): Promise<boolean>;
    readDirectory(uri: string): Promise<[string, FileType][]>;
    createDirectory(uri: string): Promise<void>;
    stat(uri: string): Promise<FileStat>;
    watch(uri: string, options: WatchOptions): Disposable;
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
}

export interface FileStat {
    readonly type: FileType;
    readonly ctime: number;
    readonly mtime: number;
    readonly size: number;
}

export interface WatchOptions {
    readonly recursive: boolean;
    readonly excludes: string[];
}

// ================================
// WORKSPACE
// ================================

export interface WorkspaceFolder {
    readonly uri: string;
    readonly name: string;
    readonly index: number;
}

export interface Workspace {
    readonly folders: readonly WorkspaceFolder[];
    readonly name?: string;

    findFiles(include: string, exclude?: string, maxResults?: number): Promise<string[]>;
    openTextDocument(uri: string): Promise<TextDocument>;
    saveTextDocument(document: TextDocument): Promise<void>;
    closeTextDocument(document: TextDocument): Promise<void>;
}
