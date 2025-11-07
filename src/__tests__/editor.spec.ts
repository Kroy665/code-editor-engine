import { CodeEditorEngine, position, selection } from '../index';

describe('CodeEditorEngine', () => {
    let editor: CodeEditorEngine;

    beforeEach(() => {
        editor = new CodeEditorEngine({
            tabSize: 2,
            insertSpaces: true,
        });
    });

    afterEach(() => {
        editor.dispose();
    });

    describe('Document operations', () => {
        test('should create editor and open document', async () => {
            const content = 'function hello() {\n  console.log("Hello, World!");\n}';
            await editor.openDocument('test.js', content, 'javascript');

            expect(editor.document).toBeDefined();
            expect(editor.document?.uri).toBe('test.js');
            expect(editor.document?.languageId).toBe('javascript');
            expect(editor.document?.getText()).toBe(content);
        });

        test('should insert text at position', async () => {
            const initialContent = 'function hello() {\n  console.log("Hello, World!");\n}';
            await editor.openDocument('test.js', initialContent, 'javascript');

            const textToInsert = '\n\nhello();\n';
            await editor.insertText(textToInsert, position(2, 1));

            const newContent = editor.document?.getText();
            expect(newContent).toContain('hello();');
            expect(editor.document?.lineCount).toBeGreaterThan(3);
        });

        test('should report correct line count', async () => {
            const content = 'line1\nline2\nline3';
            await editor.openDocument('test.js', content, 'javascript');

            expect(editor.document?.lineCount).toBe(3);
        });
    });

    describe('Undo/Redo operations', () => {
        beforeEach(async () => {
            const content = 'function hello() {\n  console.log("Hello, World!");\n}';
            await editor.openDocument('test.js', content, 'javascript');
        });

        test('should undo text insertion', async () => {
            const beforeUndo = editor.document?.getText();

            await editor.insertText('\n\nhello();\n', position(2, 1));
            const afterInsert = editor.document?.getText();

            expect(beforeUndo).not.toBe(afterInsert);

            await editor.undo();
            const afterUndo = editor.document?.getText();

            expect(afterUndo).toBe(beforeUndo);
        });

        test('should redo text insertion', async () => {
            const beforeUndo = editor.document?.getText();

            await editor.insertText('\n\nhello();\n', position(2, 1));
            const afterInsert = editor.document?.getText();

            await editor.undo();
            expect(editor.document?.getText()).toBe(beforeUndo);

            await editor.redo();
            const afterRedo = editor.document?.getText();

            expect(afterRedo).toBe(afterInsert);
        });

        test('should report undo/redo availability', async () => {
            expect(editor.canUndo()).toBe(false);
            expect(editor.canRedo()).toBe(false);

            await editor.insertText('test', position(0, 0));

            expect(editor.canUndo()).toBe(true);
            expect(editor.canRedo()).toBe(false);

            await editor.undo();

            expect(editor.canUndo()).toBe(false);
            expect(editor.canRedo()).toBe(true);
        });
    });

    describe('Selections', () => {
        beforeEach(async () => {
            const content = 'function hello() {\n  console.log("Hello, World!");\n}';
            await editor.openDocument('test.js', content, 'javascript');
        });

        test('should set multiple selections', () => {
            const selections = [
                selection(0, 0, 0, 8), // Select 'function'
                selection(1, 2, 1, 9), // Select 'console'
            ];

            editor.setSelections(selections);

            expect(editor.selections).toHaveLength(2);
            expect(editor.selections[0].start.line).toBe(0);
            expect(editor.selections[1].start.line).toBe(1);
        });

        test('should handle selection positions', () => {
            const sel = selection(0, 5, 0, 10);
            editor.setSelections([sel]);

            const currentSelection = editor.selections[0];
            expect(currentSelection.start.column).toBe(5);
            expect(currentSelection.end.column).toBe(10);
        });
    });

    describe('Language services', () => {
        beforeEach(async () => {
            await editor.openDocument('test.js', 'function hello() {}', 'javascript');
        });

        test('should get language service for javascript', () => {
            const jsService = editor.getLanguageService('javascript');
            expect(jsService).toBeDefined();
        });

        test('should return undefined for unsupported language', () => {
            const unsupportedService = editor.getLanguageService('unsupported');
            expect(unsupportedService).toBeNull();
        });
    });

    describe('Text operations', () => {
        beforeEach(async () => {
            const content = 'hello world\nhello universe';
            await editor.openDocument('test.js', content, 'javascript');
        });

        test('should support text content operations', async () => {
            const text = editor.document?.getText();
            expect(text).toContain('hello world');
            expect(text).toContain('hello universe');
        });
    });

    describe('Cleanup', () => {
        test('should dispose editor without errors', async () => {
            const tempEditor = new CodeEditorEngine();
            await tempEditor.openDocument('test.js', 'test', 'javascript');

            expect(() => {
                tempEditor.dispose();
            }).not.toThrow();
        });
    });

    describe('Document properties', () => {
        test('should expose document properties', async () => {
            const content = 'test content';
            await editor.openDocument('test.js', content, 'javascript');

            expect(editor.document?.uri).toBe('test.js');
            expect(editor.document?.languageId).toBe('javascript');
            expect(editor.document?.getText()).toBe(content);
            expect(editor.document?.lineCount).toBeGreaterThan(0);
        });
    });
});
