import {
  Extension,
  ExtensionContext,
  Memento,
  TextDocumentProvider,
  Command,
  LanguageService,
  Disposable,
  CodeEditor
} from '../types/core.js';
import { TypedEventEmitter, CompositeDisposable, DisposableImpl } from '../core/EventSystem.js';

/**
 * Extension activation events
 */
export enum ActivationEvent {
  OnStartup = 'onStartup',
  OnLanguage = 'onLanguage',
  OnCommand = 'onCommand',
  OnFileSystem = 'onFileSystem',
  OnDebug = 'onDebug',
  OnView = 'onView'
}

/**
 * Extension metadata
 */
export interface ExtensionManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly publisher?: string;
  readonly displayName?: string;
  readonly categories?: string[];
  readonly keywords?: string[];
  readonly icon?: string;
  readonly license?: string;
  readonly repository?: string;
  readonly bugs?: string;
  readonly homepage?: string;
  readonly engines?: Record<string, string>;
  readonly activationEvents?: string[];
  readonly main?: string;
  readonly contributes?: ExtensionContributions;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

/**
 * Extension contributions
 */
export interface ExtensionContributions {
  readonly commands?: CommandContribution[];
  readonly languages?: LanguageContribution[];
  readonly grammars?: GrammarContribution[];
  readonly themes?: ThemeContribution[];
  readonly snippets?: SnippetContribution[];
  readonly keybindings?: KeybindingContribution[];
  readonly menus?: MenuContribution[];
  readonly configuration?: ConfigurationContribution;
  readonly views?: ViewContribution[];
  readonly viewsContainers?: ViewContainerContribution[];
}

export interface CommandContribution {
  readonly command: string;
  readonly title: string;
  readonly category?: string;
  readonly icon?: string;
  readonly enablement?: string;
}

export interface LanguageContribution {
  readonly id: string;
  readonly aliases?: string[];
  readonly extensions?: string[];
  readonly filenames?: string[];
  readonly filenamePatterns?: string[];
  readonly mimetypes?: string[];
  readonly firstLine?: string;
  readonly configuration?: string;
}

export interface GrammarContribution {
  readonly language: string;
  readonly scopeName: string;
  readonly path: string;
  readonly embeddedLanguages?: Record<string, string>;
  readonly tokenTypes?: Record<string, string>;
  readonly injectTo?: string[];
}

export interface ThemeContribution {
  readonly label: string;
  readonly uiTheme: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';
  readonly path: string;
}

export interface SnippetContribution {
  readonly language: string;
  readonly path: string;
}

export interface KeybindingContribution {
  readonly command: string;
  readonly key: string;
  readonly mac?: string;
  readonly linux?: string;
  readonly win?: string;
  readonly when?: string;
}

export interface MenuContribution {
  readonly commandPalette?: MenuItemContribution[];
  readonly editor?: {
    readonly context?: MenuItemContribution[];
    readonly title?: MenuItemContribution[];
  };
  readonly explorer?: {
    readonly context?: MenuItemContribution[];
  };
}

export interface MenuItemContribution {
  readonly command: string;
  readonly when?: string;
  readonly group?: string;
  readonly order?: number;
}

export interface ConfigurationContribution {
  readonly title: string;
  readonly properties: Record<string, ConfigurationProperty>;
}

export interface ConfigurationProperty {
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly default?: any;
  readonly description: string;
  readonly enum?: any[];
  readonly enumDescriptions?: string[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly pattern?: string;
  readonly items?: ConfigurationProperty;
  readonly properties?: Record<string, ConfigurationProperty>;
  readonly markdownDescription?: string;
  readonly deprecationMessage?: string;
  readonly scope?: 'application' | 'machine' | 'window' | 'resource' | 'language-overridable' | 'machine-overridable';
}

export interface ViewContribution {
  readonly id: string;
  readonly name: string;
  readonly when?: string;
  readonly icon?: string;
  readonly contextualTitle?: string;
  readonly visibility?: 'visible' | 'hidden' | 'collapsed';
}

export interface ViewContainerContribution {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
}

/**
 * Extension state storage
 */
class ExtensionMemento implements Memento {
  private storage = new Map<string, any>();

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.storage.get(key);
    return value !== undefined ? value : defaultValue;
  }

  async update(key: string, value: any): Promise<void> {
    if (value === undefined) {
      this.storage.delete(key);
    } else {
      this.storage.set(key, value);
    }
  }

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Extension context implementation
 */
class ExtensionContextImpl implements ExtensionContext {
  public readonly globalState: Memento;
  public readonly workspaceState: Memento;
  private readonly disposables = new CompositeDisposable();

  constructor(
    public readonly extensionId: string,
    private readonly editor: CodeEditor
  ) {
    this.globalState = new ExtensionMemento();
    this.workspaceState = new ExtensionMemento();
  }

  registerCommand(_commandId: string, command: Command): Disposable {
    const disposable = this.editor.registerCommand(command);
    this.disposables.add(disposable);
    return disposable;
  }

  registerLanguageService(service: LanguageService): Disposable {
    const disposable = this.editor.registerLanguageService(service);
    this.disposables.add(disposable);
    return disposable;
  }

  registerTextDocumentProvider(_scheme: string, _provider: TextDocumentProvider): Disposable {
    // In a full implementation, this would register with a document provider registry
    const disposable = new DisposableImpl(() => {
      // Cleanup provider registration
    });
    this.disposables.add(disposable);
    return disposable;
  }

  dispose(): void {
    this.disposables.dispose();
  }
}

/**
 * Extension host for managing extension lifecycle
 */
export class ExtensionHost extends TypedEventEmitter<{
  'extension-activated': { extension: Extension };
  'extension-deactivated': { extension: Extension };
  'extension-error': { extension: Extension; error: Error };
}> {
  private readonly extensions = new Map<string, Extension>();
  private readonly contexts = new Map<string, ExtensionContextImpl>();
  private readonly activatedExtensions = new Set<string>();
  private readonly disposables = new CompositeDisposable();

  constructor(private readonly editor: CodeEditor) {
    super();
  }

  /**
   * Register an extension
   */
  async registerExtension(extension: Extension): Promise<void> {
    if (this.extensions.has(extension.id)) {
      throw new Error(`Extension with id '${extension.id}' is already registered`);
    }

    this.extensions.set(extension.id, extension);
    
    // Create extension context
    const context = new ExtensionContextImpl(extension.id, this.editor);
    this.contexts.set(extension.id, context);

    // Auto-activate if no activation events specified
    if (!extension.activationEvents || extension.activationEvents.length === 0) {
      await this.activateExtension(extension.id);
    }
  }

  /**
   * Activate an extension
   */
  async activateExtension(extensionId: string): Promise<void> {
    if (this.activatedExtensions.has(extensionId)) {
      return; // Already activated
    }

    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Extension '${extensionId}' not found`);
    }

    const context = this.contexts.get(extensionId);
    if (!context) {
      throw new Error(`Context for extension '${extensionId}' not found`);
    }

    try {
      await extension.activate(context);
      this.activatedExtensions.add(extensionId);
      this.emit('extension-activated', { extension });
    } catch (error) {
      this.emit('extension-error', { extension, error: error as Error });
      throw error;
    }
  }

  /**
   * Deactivate an extension
   */
  async deactivateExtension(extensionId: string): Promise<void> {
    if (!this.activatedExtensions.has(extensionId)) {
      return; // Not activated
    }

    const extension = this.extensions.get(extensionId);
    if (!extension) {
      return;
    }

    const context = this.contexts.get(extensionId);
    if (context) {
      context.dispose();
    }

    try {
      if (extension.deactivate) {
        await extension.deactivate();
      }
      this.activatedExtensions.delete(extensionId);
      this.emit('extension-deactivated', { extension });
    } catch (error) {
      this.emit('extension-error', { extension, error: error as Error });
      throw error;
    }
  }

  /**
   * Get an extension by ID
   */
  getExtension(extensionId: string): Extension | undefined {
    return this.extensions.get(extensionId);
  }

  /**
   * Get all registered extensions
   */
  getAllExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get all activated extensions
   */
  getActivatedExtensions(): Extension[] {
    return Array.from(this.activatedExtensions)
      .map(id => this.extensions.get(id))
      .filter((ext): ext is Extension => ext !== undefined);
  }

  /**
   * Check if an extension is activated
   */
  isActivated(extensionId: string): boolean {
    return this.activatedExtensions.has(extensionId);
  }

  /**
   * Activate extensions based on event
   */
  async activateByEvent(event: string): Promise<void> {
    const toActivate: string[] = [];

    for (const [id, extension] of this.extensions) {
      if (this.activatedExtensions.has(id)) {
        continue; // Already activated
      }

      if (extension.activationEvents?.includes(event)) {
        toActivate.push(id);
      }
    }

    // Activate extensions in parallel
    await Promise.allSettled(
      toActivate.map(id => this.activateExtension(id))
    );
  }

  /**
   * Dispose the extension host
   */
  override dispose(): void {
    // Deactivate all extensions
    const activatedIds = Array.from(this.activatedExtensions);
    for (const id of activatedIds) {
      try {
        this.deactivateExtension(id);
      } catch (error) {
        console.error(`Error deactivating extension ${id}:`, error);
      }
    }

    this.disposables.dispose();
    super.dispose();
  }
}

/**
 * Extension loader for loading extensions from manifests
 */
export class ExtensionLoader {
  constructor(private readonly extensionHost: ExtensionHost) {} // eslint-disable-line @typescript-eslint/no-unused-vars

  /**
   * Load extension from manifest
   */
  async loadFromManifest(manifest: ExtensionManifest, extensionCode: Extension): Promise<void> {
    // Validate manifest
    this.validateManifest(manifest);

    // Enhance extension with manifest data
    const enhancedExtension: Extension = {
      ...extensionCode,
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      ...(manifest.description && { description: manifest.description }),
      ...(manifest.activationEvents && { activationEvents: manifest.activationEvents })
    };

    // Register with extension host
    await this.extensionHost.registerExtension(enhancedExtension);
  }

  /**
   * Load multiple extensions
   */
  async loadExtensions(extensions: Array<{ manifest: ExtensionManifest; code: Extension }>): Promise<void> {
    // Sort by dependencies (simplified - in production you'd need proper dependency resolution)
    const sorted = this.sortByDependencies(extensions);
    
    for (const { manifest, code } of sorted) {
      try {
        await this.loadFromManifest(manifest, code);
      } catch (error) {
        console.error(`Failed to load extension ${manifest.id}:`, error);
      }
    }
  }

  private validateManifest(manifest: ExtensionManifest): void {
    if (!manifest.id) {
      throw new Error('Extension manifest must have an id');
    }
    if (!manifest.name) {
      throw new Error('Extension manifest must have a name');
    }
    if (!manifest.version) {
      throw new Error('Extension manifest must have a version');
    }
    
    // Validate semver
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error('Extension version must be a valid semver');
    }
  }

  private sortByDependencies(
    extensions: Array<{ manifest: ExtensionManifest; code: Extension }>
  ): Array<{ manifest: ExtensionManifest; code: Extension }> {
    // Simplified dependency sorting - in production you'd implement proper topological sort
    return extensions.sort((a, b) => {
      const aDeps = Object.keys(a.manifest.dependencies || {}).length;
      const bDeps = Object.keys(b.manifest.dependencies || {}).length;
      return aDeps - bDeps;
    });
  }
}

/**
 * Built-in extensions
 */
export class BuiltInExtensions {
  /**
   * Create a basic language support extension
   */
  static createLanguageExtension(
    languageId: string,
    languageName: string,
    languageService: LanguageService
  ): Extension {
    return {
      id: `builtin.${languageId}`,
      name: `${languageName} Language Support`,
      version: '1.0.0',
      description: `Built-in ${languageName} language support`,
      activationEvents: [`onLanguage:${languageId}`],
      
      async activate(context: ExtensionContext) {
        context.registerLanguageService(languageService);
      }
    };
  }

  /**
   * Create a basic commands extension
   */
  static createCommandsExtension(commands: Command[]): Extension {
    return {
      id: 'builtin.commands',
      name: 'Built-in Commands',
      version: '1.0.0',
      description: 'Essential editor commands',
      
      async activate(context: ExtensionContext) {
        for (const command of commands) {
          context.registerCommand(command.id, command);
        }
      }
    };
  }

  /**
   * Create a basic themes extension
   */
  static createThemesExtension(): Extension {
    return {
      id: 'builtin.themes',
      name: 'Built-in Themes',
      version: '1.0.0',
      description: 'Default editor themes',
      
      async activate(_context: ExtensionContext) {
        // In a full implementation, this would register theme providers
        console.log('Themes extension activated');
      }
    };
  }
}

/**
 * Extension marketplace interface
 */
export interface ExtensionMarketplace {
  search(query: string, options?: SearchOptions): Promise<ExtensionSearchResult[]>;
  install(extensionId: string): Promise<void>;
  uninstall(extensionId: string): Promise<void>;
  update(extensionId: string): Promise<void>;
  getInstalled(): Promise<Extension[]>;
}

export interface SearchOptions {
  readonly category?: string;
  readonly sortBy?: 'relevance' | 'downloads' | 'rating' | 'name';
  readonly sortOrder?: 'asc' | 'desc';
  readonly limit?: number;
  readonly offset?: number;
}

export interface ExtensionSearchResult {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly publisher: string;
  readonly downloads: number;
  readonly rating: number;
  readonly categories: string[];
  readonly icon?: string;
}

/**
 * Factory for creating extension-enabled editors
 */
export class ExtensibleEditor {
  static create(options: {
    editorOptions?: any;
    extensions?: Extension[];
    builtInExtensions?: boolean;
  } = {}): { editor: CodeEditor; extensionHost: ExtensionHost } {
    const { CodeEditorEngine } = require('../core/CodeEditor.js');
    const editor = new CodeEditorEngine(options.editorOptions);
    const extensionHost = new ExtensionHost(editor);
    
    // Load built-in extensions if requested
    if (options.builtInExtensions !== false) {
      ExtensibleEditor.loadBuiltInExtensions(extensionHost);
    }
    
    // Load provided extensions
    if (options.extensions) {
      for (const extension of options.extensions) {
        extensionHost.registerExtension(extension);
      }
    }
    
    return { editor, extensionHost };
  }
  
  private static async loadBuiltInExtensions(extensionHost: ExtensionHost): Promise<void> {
    // Load built-in language extensions
    const { TokenizerLanguageService } = require('./Tokenizer.js');
    
    const jsExtension = BuiltInExtensions.createLanguageExtension(
      'javascript',
      'JavaScript',
      new TokenizerLanguageService('javascript')
    );
    
    const tsExtension = BuiltInExtensions.createLanguageExtension(
      'typescript',
      'TypeScript',
      new TokenizerLanguageService('typescript')
    );
    
    const pyExtension = BuiltInExtensions.createLanguageExtension(
      'python',
      'Python',
      new TokenizerLanguageService('python')
    );
    
    await extensionHost.registerExtension(jsExtension);
    await extensionHost.registerExtension(tsExtension);
    await extensionHost.registerExtension(pyExtension);
    
    // Activate language extensions
    await extensionHost.activateByEvent('onStartup');
  }
}