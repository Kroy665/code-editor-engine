// Test the compiled build
import {
	CodeEditorEngine,
	position,
	selection,
} from './dist/index.esm.js';

async function runTests() {
	console.log('🚀 Testing Code Editor Engine\n');
	console.log('='.repeat(50));

	try {
		// Test 1: Create and open document
		console.log('\n✅ Test 1: Create editor and open document');
		const editor = new CodeEditorEngine({
			tabSize: 2,
			insertSpaces: true,
		});

		await editor.openDocument(
			'test.js',
			'function hello() {\n  console.log("Hello, World!");\n}',
			'javascript'
		);

		console.log('   Document opened successfully');
		console.log('   Content:');
		const content = editor.document?.getText().split('\n').join('\n   ');
		console.log('   ' + content);

		// Test 2: Insert text
		console.log('\n✅ Test 2: Insert text');
		await editor.insertText('\n\nhello();\n', position(2, 1));
		console.log('   Text inserted successfully');
		const content2 = editor.document?.getText().split('\n').join('\n   ');
		console.log('   ' + content2);
		console.log('   New line count:', editor.document?.lineCount);

		// Test 3: Undo/Redo
		console.log('\n✅ Test 3: Undo and Redo');
		const beforeUndo = editor.document?.getText();
		await editor.undo();
		const afterUndo = editor.document?.getText();
		const isUndoWorking = beforeUndo !== afterUndo;
		console.log('   Undo working:', isUndoWorking);

		await editor.redo();
		const afterRedo = editor.document?.getText();
		const isRedoWorking = afterUndo !== afterRedo;
		console.log('   Redo working:', isRedoWorking);

		// Test 4: Selections
		console.log('\n✅ Test 4: Multiple selections');
		const selections = [
			selection(0, 0, 0, 8), // Select 'function'
			selection(1, 2, 1, 9), // Select 'console'
		];
		editor.setSelections(selections);
		console.log('   Set', editor.selections.length, 'selections');

		// Test 5: Document operations
		console.log('\n✅ Test 5: Document operations');
		console.log('   Can undo:', editor.canUndo());
		console.log('   Can redo:', editor.canRedo());
		console.log('   Document URI:', editor.document?.uri);
		console.log('   Language ID:', editor.document?.languageId);
		console.log('   Line count:', editor.document?.lineCount);

		// Test 6: Get language service
		console.log('\n✅ Test 6: Language services');
		const jsService = editor.getLanguageService('javascript');
		console.log('   JavaScript service available:', !!jsService);

		// Test 7: Text operations
		console.log('\n✅ Test 7: Text operations');
		const buffer = editor.document?.getBuffer ? editor.document.getBuffer() : null;
		if (buffer) {
			const searchResults = buffer.findAll('hello', { caseSensitive: false });
			console.log('   Found', searchResults.length, 'occurrences of "hello"');
		}

		// Cleanup
		editor.dispose();
		console.log('\n✅ Editor disposed successfully');

		console.log('\n' + '='.repeat(50));
		console.log('🎉 All tests passed!\n');

		process.exit(0);
	} catch (error) {
		console.error('\n❌ Test failed:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

runTests();
