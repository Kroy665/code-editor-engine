/**
 * Future-Proof Headless Code Editor Engine
 *
 * A platform-agnostic, extensible code editor engine built for maximum
 * flexibility and performance. This engine provides the core logic for
 * text editing, syntax highlighting, language services, and extension
 * management without any UI dependencies.
 *
 * @version 1.0.0
 * @author Koushik Roy
 * @license MIT
 */

// ================================
// CORE TYPES
// ================================
export * from './types/core.js';

// ================================
// CORE ENGINE
// ================================
export { LineBuffer, TextDocumentImpl } from './core/TextDocument.js';

export {
    TypedEventEmitter,
    PriorityEventEmitter,
    AsyncEventEmitter,
    DisposableImpl,
    CompositeDisposable,
    combineDisposables,
    createDisposable,
} from './core/EventSystem.js';

export {
    UndoableCommand,
    TextEditCommand,
    CompositeCommand,
    CommandRegistry,
    CommandHistory,
    CommandGrouper,
    BuiltInCommands,
} from './core/CommandSystem.js';

export { CodeEditorEngine, createCodeEditor, EditorBuilder, editor } from './core/CodeEditor.js';

// ================================
// LANGUAGE SERVICES
// ================================
export { Tokenizer, TokenizerLanguageService, BuiltInLanguages } from './language/Tokenizer.js';

export type {
    EnhancedToken,
    TokenRule,
    LanguageDefinition,
    BracketDefinition,
    CommentDefinition,
    StringDefinition,
} from './language/Tokenizer.js';

// ================================
// EXTENSION SYSTEM
// ================================
export {
    ExtensionHost,
    ExtensionLoader,
    BuiltInExtensions,
    ExtensibleEditor,
    ActivationEvent,
} from './language/Extensions.js';

export type {
    ExtensionManifest,
    ExtensionContributions,
    CommandContribution,
    LanguageContribution,
    GrammarContribution,
    ThemeContribution,
    SnippetContribution,
    KeybindingContribution,
    MenuContribution,
    MenuItemContribution,
    ConfigurationContribution,
    ConfigurationProperty,
    ViewContribution,
    ViewContainerContribution,
    ExtensionMarketplace,
    SearchOptions,
    ExtensionSearchResult,
} from './language/Extensions.js';

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Create a complete editor instance with sensible defaults
 */
export function createEditor(
    options: {
        /** Editor configuration options */
        editorOptions?: Partial<import('./types/core.js').EditorOptions>;
        /** Language IDs to enable */
        languages?: string[];
        /** Custom extensions to load */
        extensions?: import('./types/core.js').Extension[];
        /** Whether to load built-in extensions */
        builtInExtensions?: boolean;
    } = {},
) {
    const { ExtensibleEditor } = require('./language/Extensions.js');
    const { editor, extensionHost } = ExtensibleEditor.create({
        editorOptions: options.editorOptions,
        extensions: options.extensions,
        builtInExtensions: options.builtInExtensions,
    } as any);

    // Activate language-specific extensions
    if (options.languages) {
        void Promise.allSettled(
            options.languages.map((lang) => extensionHost.activateByEvent(`onLanguage:${lang}`)),
        );
    }

    return { editor, extensionHost };
}

/**
 * Create a minimal editor instance without extensions
 */
export function createMinimalEditor(options?: Partial<import('./types/core.js').EditorOptions>) {
    const { CodeEditorEngine } = require('./core/CodeEditor.js');
    return new CodeEditorEngine(options);
}

/**
 * Utility to create a position
 */
export function position(line: number, column: number): import('./types/core.js').Position {
    return { line, column };
}

/**
 * Utility to create a range
 */
export function range(
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
): import('./types/core.js').Range {
    return {
        start: { line: startLine, column: startColumn },
        end: { line: endLine, column: endColumn },
    };
}

/**
 * Utility to create a selection
 */
export function selection(
    anchorLine: number,
    anchorColumn: number,
    activeLine: number,
    activeColumn: number,
): import('./types/core.js').Selection {
    const anchor = { line: anchorLine, column: anchorColumn };
    const active = { line: activeLine, column: activeColumn };
    const isReversed =
        activeLine < anchorLine || (activeLine === anchorLine && activeColumn < anchorColumn);

    return {
        start: isReversed ? active : anchor,
        end: isReversed ? anchor : active,
        anchor,
        active,
        isReversed,
    };
}

// ================================
// VERSION INFO
// ================================
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// ================================
// FEATURE FLAGS
// ================================
export const FEATURES = {
    SYNTAX_HIGHLIGHTING: true,
    LANGUAGE_SERVICES: true,
    EXTENSIONS: true,
    UNDO_REDO: true,
    MULTI_CURSOR: true,
    FIND_REPLACE: true,
    CODE_FOLDING: false, // Not implemented in this version
    MINIMAP: false, // Not implemented in this version
    INTELLISENSE: true,
    DIAGNOSTICS: true,
    CODE_ACTIONS: true,
    FORMATTING: true,
    RENAME: true,
    GOTO_DEFINITION: true,
    HOVER: true,
} as const;

// ================================
// COMPATIBILITY
// ================================

/**
 * Platform detection utilities
 */
export const Platform = {
    /**
     * Check if running in a React Native environment
     */
    isReactNative(): boolean {
        return typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';
    },

    /**
     * Check if running in a web browser
     */
    isBrowser(): boolean {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    },

    /**
     * Check if running in Node.js
     */
    isNode(): boolean {
        return (
            typeof process !== 'undefined' &&
            typeof (process as any).versions === 'object' &&
            typeof (process as any).versions.node === 'string'
        );
    },

    /**
     * Check if running in a worker context
     */
    isWorker(): boolean {
        return typeof (globalThis as any).importScripts === 'function';
    },
};

/**
 * Performance monitoring utilities
 */
export const Performance = {
    /**
     * Measure execution time of a function
     */
    async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
        const start = performance.now();
        try {
            const result = await fn();
            const end = performance.now();
            console.debug(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
            return result;
        } catch (error) {
            const end = performance.now();
            console.debug(`[Performance] ${name} (error): ${(end - start).toFixed(2)}ms`);
            throw error;
        }
    },

    /**
     * Simple profiler for development
     */
    profile<T>(fn: () => T): { result: T; time: number } {
        const start = performance.now();
        const result = fn();
        const time = performance.now() - start;
        return { result, time };
    },
};

/**
 * Memory management utilities
 */
export const Memory = {
    /**
     * Request garbage collection (if available)
     */
    gc(): void {
        if (typeof global !== 'undefined' && global.gc) {
            global.gc();
        }
    },

    /**
     * Get memory usage information (Node.js only)
     */
    getUsage(): any {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage();
        }
        return null;
    },
};

// ================================
// DEVELOPMENT HELPERS
// ================================

/**
 * Development mode flag
 */
export const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Debug logging utility
 */
export const Debug = {
    log: IS_DEV ? console.log.bind(console, '[Editor]') : () => {},
    warn: IS_DEV ? console.warn.bind(console, '[Editor]') : () => {},
    error: console.error.bind(console, '[Editor]'),
    group: IS_DEV ? console.group.bind(console) : () => {},
    groupEnd: IS_DEV ? console.groupEnd.bind(console) : () => {},
    time: IS_DEV ? console.time.bind(console) : () => {},
    timeEnd: IS_DEV ? console.timeEnd.bind(console) : () => {},
};

// ================================
// CONSTANTS
// ================================
export const CONSTANTS = {
    DEFAULT_TAB_SIZE: 4,
    DEFAULT_UNDO_STACK_SIZE: 1000,
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    TOKENIZATION_CHUNK_SIZE: 1000,
    DEFAULT_GROUPING_TIMEOUT: 300,
    MAX_SELECTIONS: 10000,
} as const;

/**
 * Common error types
 */
export class EditorError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
    ) {
        super(message);
        this.name = 'EditorError';
    }
}

export class DocumentError extends EditorError {
    constructor(
        message: string,
        public readonly uri?: string,
    ) {
        super(message, 'DOCUMENT_ERROR');
        this.name = 'DocumentError';
    }
}

export class ExtensionError extends EditorError {
    constructor(
        message: string,
        public readonly extensionId?: string,
    ) {
        super(message, 'EXTENSION_ERROR');
        this.name = 'ExtensionError';
    }
}

export class LanguageServiceError extends EditorError {
    constructor(
        message: string,
        public readonly languageId?: string,
    ) {
        super(message, 'LANGUAGE_SERVICE_ERROR');
        this.name = 'LanguageServiceError';
    }
}
