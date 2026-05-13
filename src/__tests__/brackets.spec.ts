import { createEditor, position } from '../index';

describe('Bracket Matching', () => {
    describe('findMatchingBracket', () => {
        it('should find matching closing bracket', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', 'function test() { return 1; }', 'javascript');

            // Position at opening brace
            const match = editor.findMatchingBracket(position(0, 16));

            expect(match).not.toBeNull();
            expect(match?.open.start).toEqual({ line: 0, column: 16 });
            expect(match?.close.start).toEqual({ line: 0, column: 28 });
            expect(match?.bracketPair.open).toBe('{');
            expect(match?.bracketPair.close).toBe('}');

            editor.dispose();
        });

        it('should find matching opening bracket', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', 'function test() { return 1; }', 'javascript');

            // Position at closing brace
            const match = editor.findMatchingBracket(position(0, 28));

            expect(match).not.toBeNull();
            expect(match?.open.start).toEqual({ line: 0, column: 16 });
            expect(match?.close.start).toEqual({ line: 0, column: 28 });

            editor.dispose();
        });

        it('should handle nested brackets', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', 'if (true) { while (x) { } }', 'javascript');

            // Position at outer opening brace
            const outerMatch = editor.findMatchingBracket(position(0, 10));
            expect(outerMatch?.close.start.column).toBe(26);

            // Position at inner opening brace
            const innerMatch = editor.findMatchingBracket(position(0, 22));
            expect(innerMatch?.close.start.column).toBe(24);

            editor.dispose();
        });

        it('should return null for non-bracket position', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', 'const x = 1;', 'javascript');

            const match = editor.findMatchingBracket(position(0, 0));

            expect(match).toBeNull();

            editor.dispose();
        });
    });

    describe('findSurroundingBrackets', () => {
        it('should find surrounding brackets', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', 'function test() { return 1; }', 'javascript');

            // Position inside the function body
            const match = editor.findSurroundingBrackets(position(0, 25));

            expect(match).not.toBeNull();
            expect(match?.open.start.column).toBe(16);
            expect(match?.close.start.column).toBe(28);

            editor.dispose();
        });

        it('should find innermost surrounding brackets', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', 'if (true) { while (x) { y; } }', 'javascript');

            // Position at 'y' should find inner brackets
            const match = editor.findSurroundingBrackets(position(0, 24));

            expect(match).not.toBeNull();
            expect(match?.open.start.column).toBe(22);
            expect(match?.close.start.column).toBe(27);

            editor.dispose();
        });
    });

    describe('isInsideBrackets', () => {
        it('should return true when inside brackets', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', 'function test() { return 1; }', 'javascript');

            expect(editor.isInsideBrackets(position(0, 20))).toBe(true);

            editor.dispose();
        });

        it('should return false when outside brackets', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', 'const x = 1;', 'javascript');

            expect(editor.isInsideBrackets(position(0, 5))).toBe(false);

            editor.dispose();
        });
    });
});

describe('Auto-Closing Pairs', () => {
    describe('auto-close brackets', () => {
        it('should auto-close opening parenthesis', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', '', 'javascript');

            await editor.insertText('(');

            const content = editor.document?.getText();
            expect(content).toBe('()');

            // Cursor should be between the pair
            expect(editor.selections[0].active).toEqual({ line: 0, column: 1 });

            editor.dispose();
        });

        it('should auto-close opening bracket', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', '', 'javascript');

            await editor.insertText('[');

            expect(editor.document?.getText()).toBe('[]');

            editor.dispose();
        });

        it('should auto-close opening brace', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', '', 'javascript');

            await editor.insertText('{');

            expect(editor.document?.getText()).toBe('{}');

            editor.dispose();
        });

        it('should auto-close double quotes', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', '', 'javascript');

            await editor.insertText('"');

            expect(editor.document?.getText()).toBe('""');

            editor.dispose();
        });

        it('should auto-close single quotes', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', '', 'javascript');

            await editor.insertText("'");

            expect(editor.document?.getText()).toBe("''");

            editor.dispose();
        });
    });

    describe('skip over closing brackets', () => {
        it('should skip over closing parenthesis', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', '()', 'javascript');

            // Move cursor between the pair
            editor.setSelections([{
                start: position(0, 1),
                end: position(0, 1),
                anchor: position(0, 1),
                active: position(0, 1),
                isReversed: false,
            }]);

            await editor.insertText(')');

            // Should skip over, not insert
            expect(editor.document?.getText()).toBe('()');
            expect(editor.selections[0].active.column).toBe(2);

            editor.dispose();
        });

        it('should skip over closing quote', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', '""', 'javascript');

            editor.setSelections([{
                start: position(0, 1),
                end: position(0, 1),
                anchor: position(0, 1),
                active: position(0, 1),
                isReversed: false,
            }]);

            await editor.insertText('"');

            // Should skip over
            expect(editor.document?.getText()).toBe('""');
            expect(editor.selections[0].active.column).toBe(2);

            editor.dispose();
        });
    });

    describe('events', () => {
        it('should emit bracket-matched event', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', 'function test() {}', 'javascript');

            const events: unknown[] = [];
            editor.on('bracket-matched', (data: unknown) => events.push(data));

            editor.findMatchingBracket(position(0, 16));

            expect(events.length).toBe(1);

            editor.dispose();
        });

        it('should emit auto-close-triggered event', async () => {
            const { editor } = createEditor();
            await editor.openDocument('test.js', '', 'javascript');

            const events: unknown[] = [];
            editor.on('auto-close-triggered', (data: unknown) => events.push(data));

            await editor.insertText('(');

            expect(events.length).toBe(1);
            expect((events[0] as { openChar: string; closeChar: string }).openChar).toBe('(');
            expect((events[0] as { openChar: string; closeChar: string }).closeChar).toBe(')');

            editor.dispose();
        });
    });
});
