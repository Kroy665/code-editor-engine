import { Command, CommandContext, Disposable, Position, Range } from '../types/core';
import { TypedEventEmitter, DisposableImpl } from './EventSystem';

/**
 * Base implementation for undoable commands
 */
export abstract class UndoableCommand implements Command {
    public readonly id: string;
    public readonly label: string;
    protected executed = false;
    protected undone = false;

    constructor(id: string, label: string) {
        this.id = id;
        this.label = label;
    }

    abstract execute(...args: any[]): Promise<any> | any;
    abstract undo(): Promise<void> | void;

    redo(): Promise<void> | void {
        if (this.undone) {
            this.undone = false;
            this.executed = true;
            return this.execute();
        }
    }

    protected markExecuted(): void {
        this.executed = true;
        this.undone = false;
    }

    protected markUndone(): void {
        this.executed = false;
        this.undone = true;
    }

    get isExecuted(): boolean {
        return this.executed;
    }

    get isUndone(): boolean {
        return this.undone;
    }
}

/**
 * Text editing command for insert, delete, and replace operations
 */
export class TextEditCommand extends UndoableCommand {
    private previousText: string = '';
    private actualRange: Range;

    constructor(
        private readonly context: CommandContext,
        private readonly range: Range,
        private readonly newText: string,
        label?: string,
    ) {
        super('text.edit', label || 'Edit Text');
        this.actualRange = range;
    }

    execute(): void {
        const document = this.context.document;
        const buffer = (document as any).getBuffer();

        // Store the text that will be replaced for undo
        this.previousText = buffer.getTextRange(this.range);

        // Perform the edit
        this.actualRange = buffer.replaceText(this.range, this.newText);
        this.markExecuted();
    }

    undo(): void {
        if (!this.executed) return;

        const document = this.context.document;
        const buffer = (document as any).getBuffer();

        // Restore the previous text
        buffer.replaceText(this.actualRange, this.previousText);
        this.markUndone();
    }
}

/**
 * Composite command for grouping multiple commands
 */
export class CompositeCommand extends UndoableCommand {
    private commands: UndoableCommand[] = [];

    constructor(id: string, label: string, commands: UndoableCommand[] = []) {
        super(id, label);
        this.commands = [...commands];
    }

    addCommand(command: UndoableCommand): void {
        if (this.executed) {
            throw new Error('Cannot add commands to an already executed composite command');
        }
        this.commands.push(command);
    }

    execute(): void {
        for (const command of this.commands) {
            command.execute();
        }
        this.markExecuted();
    }

    undo(): void {
        if (!this.executed) return;

        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].undo();
        }
        this.markUndone();
    }

    override redo(): void {
        if (!this.undone) return;

        for (const command of this.commands) {
            command.redo();
        }
        this.markExecuted();
    }
}

/**
 * Command registry for managing available commands
 */
export class CommandRegistry {
    private commands = new Map<string, Command>();
    private handlers = new Map<string, (...args: any[]) => Promise<any> | any>();

    /**
     * Register a command
     */
    register(command: Command): Disposable {
        if (this.commands.has(command.id)) {
            throw new Error(`Command with id '${command.id}' is already registered`);
        }

        this.commands.set(command.id, command);

        return new DisposableImpl(() => {
            this.commands.delete(command.id);
        });
    }

    /**
     * Register a command handler
     */
    registerHandler(
        commandId: string,
        handler: (...args: any[]) => Promise<any> | any,
    ): Disposable {
        if (this.handlers.has(commandId)) {
            throw new Error(`Handler for command '${commandId}' is already registered`);
        }

        this.handlers.set(commandId, handler);

        return new DisposableImpl(() => {
            this.handlers.delete(commandId);
        });
    }

    /**
     * Execute a command by ID
     */
    async execute(commandId: string, ...args: any[]): Promise<any> {
        // Try handler first
        const handler = this.handlers.get(commandId);
        if (handler) {
            return await handler(...args);
        }

        // Try registered command
        const command = this.commands.get(commandId);
        if (command) {
            return await command.execute(...args);
        }

        throw new Error(`Command '${commandId}' not found`);
    }

    /**
     * Get a command by ID
     */
    get(commandId: string): Command | undefined {
        return this.commands.get(commandId);
    }

    /**
     * Get all registered command IDs
     */
    getCommandIds(): string[] {
        return Array.from(this.commands.keys());
    }

    /**
     * Check if a command is registered
     */
    has(commandId: string): boolean {
        return this.commands.has(commandId) || this.handlers.has(commandId);
    }
}

/**
 * Command history manager with undo/redo stack
 */
export class CommandHistory {
    private undoStack: UndoableCommand[] = [];
    private redoStack: UndoableCommand[] = [];
    private maxStackSize: number;
    private events = new TypedEventEmitter<{
        'command-executed': { command: UndoableCommand };
        'command-undone': { command: UndoableCommand };
        'command-redone': { command: UndoableCommand };
        'history-changed': { canUndo: boolean; canRedo: boolean };
    }>();

    constructor(maxStackSize: number = 1000) {
        this.maxStackSize = maxStackSize;
    }

    /**
     * Execute and record a command
     */
    execute(command: UndoableCommand): void {
        // Execute the command
        command.execute();

        // Add to undo stack
        this.undoStack.push(command);

        // Clear redo stack
        this.redoStack.length = 0;

        // Trim stack if too large
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }

        this.events.emit('command-executed', { command });
        this.events.emit('history-changed', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
        });
    }

    /**
     * Undo the last command
     */
    undo(): boolean {
        if (!this.canUndo()) {
            return false;
        }

        const command = this.undoStack.pop()!;
        command.undo();
        this.redoStack.push(command);

        this.events.emit('command-undone', { command });
        this.events.emit('history-changed', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
        });

        return true;
    }

    /**
     * Redo the last undone command
     */
    redo(): boolean {
        if (!this.canRedo()) {
            return false;
        }

        const command = this.redoStack.pop()!;
        command.redo();
        this.undoStack.push(command);

        this.events.emit('command-redone', { command });
        this.events.emit('history-changed', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
        });

        return true;
    }

    /**
     * Check if undo is possible
     */
    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is possible
     */
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /**
     * Clear the history
     */
    clear(): void {
        this.undoStack.length = 0;
        this.redoStack.length = 0;

        this.events.emit('history-changed', {
            canUndo: false,
            canRedo: false,
        });
    }

    /**
     * Get the size of the undo stack
     */
    get undoStackSize(): number {
        return this.undoStack.length;
    }

    /**
     * Get the size of the redo stack
     */
    get redoStackSize(): number {
        return this.redoStack.length;
    }

    /**
     * Subscribe to history events
     */
    on<K extends 'command-executed' | 'command-undone' | 'command-redone' | 'history-changed'>(
        event: K,
        listener: (data: any) => void,
    ): Disposable {
        return this.events.on(event as any, listener);
    }
}

/**
 * Smart command grouping for related operations
 */
export class CommandGrouper {
    private currentGroup: CompositeCommand | null = null;
    private groupTimeout: number | null = null;
    private readonly groupingTimeoutMs: number;

    constructor(groupingTimeoutMs: number = 300) {
        this.groupingTimeoutMs = groupingTimeoutMs;
    }

    /**
     * Start a new command group
     */
    startGroup(id: string, label: string): void {
        this.endGroup();
        this.currentGroup = new CompositeCommand(id, label);
    }

    /**
     * Add a command to the current group
     */
    addToGroup(command: UndoableCommand): void {
        if (this.currentGroup) {
            this.currentGroup.addCommand(command);
            this.resetGroupTimeout();
        }
    }

    /**
     * End the current group
     */
    endGroup(): CompositeCommand | null {
        if (this.groupTimeout) {
            clearTimeout(this.groupTimeout);
            this.groupTimeout = null;
        }

        const group = this.currentGroup;
        this.currentGroup = null;
        return group;
    }

    /**
     * Get the current group
     */
    getCurrentGroup(): CompositeCommand | null {
        return this.currentGroup;
    }

    private resetGroupTimeout(): void {
        if (this.groupTimeout) {
            clearTimeout(this.groupTimeout);
        }

        this.groupTimeout = setTimeout(() => {
            this.endGroup();
        }, this.groupingTimeoutMs) as any;
    }
}

/**
 * Built-in commands for common text operations
 */
export class BuiltInCommands {
    static createInsertTextCommand(
        context: CommandContext,
        position: Position,
        text: string,
    ): TextEditCommand {
        const range: Range = { start: position, end: position };
        return new TextEditCommand(context, range, text, `Insert "${text}"`);
    }

    static createDeleteTextCommand(context: CommandContext, range: Range): TextEditCommand {
        return new TextEditCommand(context, range, '', 'Delete Text');
    }

    static createReplaceTextCommand(
        context: CommandContext,
        range: Range,
        newText: string,
    ): TextEditCommand {
        return new TextEditCommand(context, range, newText, `Replace with "${newText}"`);
    }

    static createMultiCursorEditCommand(
        context: CommandContext,
        edits: Array<{ range: Range; text: string }>,
    ): CompositeCommand {
        const commands = edits.map(
            (edit, index) =>
                new TextEditCommand(context, edit.range, edit.text, `Multi-edit ${index + 1}`),
        );

        return new CompositeCommand('text.multiEdit', 'Multi-cursor Edit', commands);
    }
}
