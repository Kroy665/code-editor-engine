import {
    CodeEditor,
    EditorOptions,
    EditorEvents,
    TextDocument,
    Selection,
    Position,
    Range,
    Command,
    LanguageService,
    Disposable,
} from '../types/core';
import { TextDocumentImpl } from './TextDocument';
import { TypedEventEmitter, CompositeDisposable, DisposableImpl } from './EventSystem';
import { CommandRegistry, CommandHistory, UndoableCommand, BuiltInCommands } from './CommandSystem';

/**
 * Default editor options
 */
const DEFAULT_OPTIONS: EditorOptions = {
    tabSize: 4,
    insertSpaces: true,
    autoIndent: true,
    wordWrap: false,
    lineNumbers: true,
    readOnly: false,
    undoStackSize: 1000,
};

/**
 * Main code editor engine implementation
 */
export class CodeEditorEngine extends TypedEventEmitter<EditorEvents> implements CodeEditor {
    private _document: TextDocumentImpl | null = null;
    private _selections: Selection[] = [
        {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 },
            anchor: { line: 0, column: 0 },
            active: { line: 0, column: 0 },
            isReversed: false,
        },
    ];
    private _options: EditorOptions = { ...DEFAULT_OPTIONS };

    private readonly commandRegistry = new CommandRegistry();
    private readonly commandHistory = new CommandHistory(this._options.undoStackSize);
    private readonly languageServices = new Map<string, LanguageService>();
    private readonly disposables = new CompositeDisposable();

    protected override isDisposed = false;

    constructor(options: Partial<EditorOptions> = {}) {
        super();
        this.updateOptions(options);
        this.setupBuiltInCommands();
        this.setupEventForwarding();
    }

    // ================================
    // DOCUMENT MANAGEMENT
    // ================================

    get document(): TextDocument | null {
        return this._document;
    }

    async openDocument(uri: string, content: string, languageId: string): Promise<void> {
        this.ensureNotDisposed();

        // Close existing document
        if (this._document) {
            this.closeDocument();
        }

        // Create new document
        this._document = new TextDocumentImpl(uri, languageId, 1, content);

        // Reset selections to start of document
        this.setSelections([
            {
                start: { line: 0, column: 0 },
                end: { line: 0, column: 0 },
                anchor: { line: 0, column: 0 },
                active: { line: 0, column: 0 },
                isReversed: false,
            },
        ]);

        // Clear command history
        this.commandHistory.clear();

        this.emit('document-opened', { document: this._document });
    }

    closeDocument(): void {
        if (this._document) {
            const uri = this._document.uri;
            this._document = null;
            this.commandHistory.clear();
            this.emit('document-closed', { uri });
        }
    }

    async saveDocument(): Promise<void> {
        if (this._document) {
            this.emit('document-saved', { document: this._document });
        }
    }

    // ================================
    // SELECTIONS AND CURSOR
    // ================================

    get selections(): readonly Selection[] {
        return [...this._selections];
    }

    setSelections(selections: Selection[]): void {
        this.ensureNotDisposed();

        if (selections.length === 0) {
            throw new Error('At least one selection is required');
        }

        // Validate selections
        const validatedSelections = selections.map((selection) =>
            this.validateSelection(selection),
        );

        this._selections = validatedSelections;

        if (this._document) {
            this.emit('selection-changed', {
                selections: this._selections,
                document: this._document,
            });

            // Emit cursor moved for primary selection
            this.emit('cursor-moved', {
                position: this._selections[0].active,
                document: this._document,
            });
        }
    }

    private validateSelection(selection: Selection): Selection {
        if (!this._document) {
            return selection;
        }

        const buffer = this._document.getBuffer();
        const start = buffer.validatePosition(selection.start);
        const end = buffer.validatePosition(selection.end);
        const anchor = buffer.validatePosition(selection.anchor);
        const active = buffer.validatePosition(selection.active);

        return {
            start,
            end,
            anchor,
            active,
            isReversed: this.isPositionBefore(active, anchor),
        };
    }

    private isPositionBefore(a: Position, b: Position): boolean {
        return a.line < b.line || (a.line === b.line && a.column < b.column);
    }

    // ================================
    // TEXT OPERATIONS
    // ================================

    async insertText(text: string, position?: Position): Promise<void> {
        this.ensureNotDisposed();
        this.ensureDocument();

        const insertPosition = position || this._selections[0].active;
        const context = this.createCommandContext();

        const command = BuiltInCommands.createInsertTextCommand(context, insertPosition, text);
        this.executeUndoableCommand(command);

        // Update selections
        const newPosition: Position = {
            line: insertPosition.line + (text.split('\n').length - 1),
            column: text.includes('\n')
                ? text.split('\n').pop()!.length
                : insertPosition.column + text.length,
        };

        this.setSelections([
            {
                start: newPosition,
                end: newPosition,
                anchor: newPosition,
                active: newPosition,
                isReversed: false,
            },
        ]);
    }

    async deleteText(range: Range): Promise<void> {
        this.ensureNotDisposed();
        this.ensureDocument();

        const context = this.createCommandContext();
        const command = BuiltInCommands.createDeleteTextCommand(context, range);
        this.executeUndoableCommand(command);

        // Update selections to the start of the deleted range
        this.setSelections([
            {
                start: range.start,
                end: range.start,
                anchor: range.start,
                active: range.start,
                isReversed: false,
            },
        ]);
    }

    async replaceText(range: Range, text: string): Promise<void> {
        this.ensureNotDisposed();
        this.ensureDocument();

        const context = this.createCommandContext();
        const command = BuiltInCommands.createReplaceTextCommand(context, range, text);
        this.executeUndoableCommand(command);

        // Update selections
        const endPosition: Position = {
            line: range.start.line + (text.split('\n').length - 1),
            column: text.includes('\n')
                ? text.split('\n').pop()!.length
                : range.start.column + text.length,
        };

        this.setSelections([
            {
                start: endPosition,
                end: endPosition,
                anchor: endPosition,
                active: endPosition,
                isReversed: false,
            },
        ]);
    }

    // ================================
    // COMMAND SYSTEM
    // ================================

    async executeCommand(commandId: string, ...args: any[]): Promise<any> {
        this.ensureNotDisposed();
        return await this.commandRegistry.execute(commandId, ...args);
    }

    registerCommand(command: Command): Disposable {
        this.ensureNotDisposed();
        const disposable = this.commandRegistry.register(command);
        this.disposables.add(disposable);
        return disposable;
    }

    private executeUndoableCommand(command: UndoableCommand): void {
        this.commandHistory.execute(command);
        this.emitTextChanged();
    }

    private createCommandContext() {
        this.ensureDocument();
        return {
            editor: this,
            document: this._document!,
            selections: this._selections,
        };
    }

    // ================================
    // HISTORY
    // ================================

    async undo(): Promise<void> {
        this.ensureNotDisposed();

        if (this.commandHistory.undo()) {
            this.emitTextChanged();
        }
    }

    async redo(): Promise<void> {
        this.ensureNotDisposed();

        if (this.commandHistory.redo()) {
            this.emitTextChanged();
        }
    }

    canUndo(): boolean {
        return this.commandHistory.canUndo();
    }

    canRedo(): boolean {
        return this.commandHistory.canRedo();
    }

    // ================================
    // LANGUAGE SERVICES
    // ================================

    registerLanguageService(service: LanguageService): Disposable {
        this.ensureNotDisposed();

        if (this.languageServices.has(service.languageId)) {
            throw new Error(`Language service for '${service.languageId}' is already registered`);
        }

        this.languageServices.set(service.languageId, service);

        const disposable = new DisposableImpl(() => {
            this.languageServices.delete(service.languageId);
        });

        this.disposables.add(disposable);
        return disposable;
    }

    getLanguageService(languageId: string): LanguageService | null {
        return this.languageServices.get(languageId) || null;
    }

    // ================================
    // CONFIGURATION
    // ================================

    updateOptions(options: Partial<EditorOptions>): void {
        this._options = { ...this._options, ...options };

        // Update command history size if changed
        if (options.undoStackSize !== undefined) {
            // Note: CommandHistory doesn't have a resize method in this implementation
            // In a production version, you'd want to implement this
        }
    }

    getOptions(): EditorOptions {
        return { ...this._options };
    }

    // ================================
    // UTILITY METHODS
    // ================================

    private setupBuiltInCommands(): void {
        // Register built-in command handlers
        this.disposables.add(
            this.commandRegistry.registerHandler('editor.undo', () => this.undo()),
        );

        this.disposables.add(
            this.commandRegistry.registerHandler('editor.redo', () => this.redo()),
        );

        this.disposables.add(
            this.commandRegistry.registerHandler(
                'editor.insertText',
                (text: string, position?: Position) => this.insertText(text, position),
            ),
        );

        this.disposables.add(
            this.commandRegistry.registerHandler('editor.deleteText', (range: Range) =>
                this.deleteText(range),
            ),
        );

        this.disposables.add(
            this.commandRegistry.registerHandler(
                'editor.replaceText',
                (range: Range, text: string) => this.replaceText(range, text),
            ),
        );
    }

    private setupEventForwarding(): void {
        // Forward command history events
        this.disposables.add(
            this.commandHistory.on(
                'command-undone',
                ({ command }: { command: UndoableCommand }) => {
                    this.emit('undo', { command });
                },
            ),
        );

        this.disposables.add(
            this.commandHistory.on(
                'command-redone',
                ({ command }: { command: UndoableCommand }) => {
                    this.emit('redo', { command });
                },
            ),
        );
    }

    private emitTextChanged(): void {
        if (this._document) {
            this.emit('text-changed', {
                changes: [], // TODO: Track actual changes
                document: this._document,
            });
        }
    }

    private ensureNotDisposed(): void {
        if (this.isDisposed) {
            throw new Error('Editor has been disposed');
        }
    }

    private ensureDocument(): void {
        if (!this._document) {
            throw new Error('No document is open');
        }
    }

    // ================================
    // DISPOSAL
    // ================================

    override dispose(): void {
        if (!this.isDisposed) {
            this.isDisposed = true;
            this.closeDocument();
            this.disposables.dispose();
            super.dispose();
        }
    }

    override get disposed(): boolean {
        return this.isDisposed;
    }
}

/**
 * Factory function to create a new code editor instance
 */
export function createCodeEditor(options: Partial<EditorOptions> = {}): CodeEditor {
    return new CodeEditorEngine(options);
}

/**
 * Editor builder for fluent configuration
 */
export class EditorBuilder {
    private options: Partial<EditorOptions> = {};
    private languageServices: LanguageService[] = [];
    private commands: Command[] = [];

    withOptions(options: Partial<EditorOptions>): EditorBuilder {
        this.options = { ...this.options, ...options };
        return this;
    }

    withLanguageService(service: LanguageService): EditorBuilder {
        this.languageServices.push(service);
        return this;
    }

    withCommand(command: Command): EditorBuilder {
        this.commands.push(command);
        return this;
    }

    withTabSize(tabSize: number): EditorBuilder {
        this.options = { ...this.options, tabSize };
        return this;
    }

    withSpaces(insertSpaces: boolean): EditorBuilder {
        this.options = { ...this.options, insertSpaces };
        return this;
    }

    readOnly(readOnly: boolean = true): EditorBuilder {
        this.options = { ...this.options, readOnly };
        return this;
    }

    build(): CodeEditor {
        const editor = new CodeEditorEngine(this.options);

        // Register language services
        for (const service of this.languageServices) {
            editor.registerLanguageService(service);
        }

        // Register commands
        for (const command of this.commands) {
            editor.registerCommand(command);
        }

        return editor;
    }
}

/**
 * Convenience function to create an editor builder
 */
export function editor(): EditorBuilder {
    return new EditorBuilder();
}
