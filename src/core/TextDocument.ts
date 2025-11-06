import { Position, Range, TextDocument } from '../types/core.js';

/**
 * Efficient line-based text representation using a rope-like structure
 * Optimized for typical code editing operations
 */
export class LineBuffer {
  private lines: string[] = [''];
  private _version = 0;
  private _lineEndings: string = '\n'; // Default line ending

  constructor(content: string = '', lineEnding: string = '\n') {
    this._lineEndings = lineEnding;
    this.setText(content);
  }

  get version(): number {
    return this._version;
  }

  get lineCount(): number {
    return this.lines.length;
  }

  get lineEndings(): string {
    return this._lineEndings;
  }

  /**
   * Get the full text content
   */
  getText(): string {
    return this.lines.join(this._lineEndings);
  }

  /**
   * Get text within a specific range
   */
  getTextRange(range: Range): string {
    const { start, end } = this.validateRange(range);
    
    if (start.line === end.line) {
      return this.lines[start.line].substring(start.column, end.column);
    }

    const result: string[] = [];
    
    // First line
    result.push(this.lines[start.line].substring(start.column));
    
    // Middle lines
    for (let i = start.line + 1; i < end.line; i++) {
      result.push(this.lines[i]);
    }
    
    // Last line
    result.push(this.lines[end.line].substring(0, end.column));
    
    return result.join(this._lineEndings);
  }

  /**
   * Get content of a specific line
   */
  getLineContent(line: number): string {
    if (line < 0 || line >= this.lines.length) {
      throw new Error(`Line ${line} is out of bounds (0-${this.lines.length - 1})`);
    }
    return this.lines[line];
  }

  /**
   * Get line length including line ending
   */
  getLineLength(line: number): number {
    const content = this.getLineContent(line);
    const isLastLine = line === this.lines.length - 1;
    return content.length + (isLastLine ? 0 : this._lineEndings.length);
  }

  /**
   * Set the entire text content
   */
  setText(content: string): void {
    // Detect line endings
    if (content.includes('\r\n')) {
      this._lineEndings = '\r\n';
    } else if (content.includes('\r')) {
      this._lineEndings = '\r';
    } else {
      this._lineEndings = '\n';
    }

    this.lines = content.split(/\r\n|\r|\n/);
    if (this.lines.length === 0) {
      this.lines = [''];
    }
    this._version++;
  }

  /**
   * Insert text at a specific position
   */
  insertText(position: Position, text: string): Range {
    const validPosition = this.validatePosition(position);
    const insertLines = text.split(/\r\n|\r|\n/);
    
    if (insertLines.length === 1) {
      // Single line insertion
      const line = this.lines[validPosition.line];
      this.lines[validPosition.line] = 
        line.substring(0, validPosition.column) + 
        text + 
        line.substring(validPosition.column);
      
      this._version++;
      return {
        start: validPosition,
        end: { line: validPosition.line, column: validPosition.column + text.length }
      };
    } else {
      // Multi-line insertion
      const line = this.lines[validPosition.line];
      const before = line.substring(0, validPosition.column);
      const after = line.substring(validPosition.column);
      
      // Replace current line with first insert line
      this.lines[validPosition.line] = before + insertLines[0];
      
      // Insert middle lines
      const middleLines = insertLines.slice(1, -1);
      this.lines.splice(validPosition.line + 1, 0, ...middleLines);
      
      // Insert last line merged with remaining content
      const lastInsertLine = insertLines[insertLines.length - 1];
      this.lines.splice(validPosition.line + insertLines.length - 1, 0, lastInsertLine + after);
      
      this._version++;
      return {
        start: validPosition,
        end: {
          line: validPosition.line + insertLines.length - 1,
          column: lastInsertLine.length + (insertLines.length === 1 ? validPosition.column : 0)
        }
      };
    }
  }

  /**
   * Delete text in a specific range
   */
  deleteText(range: Range): string {
    const validRange = this.validateRange(range);
    const deletedText = this.getTextRange(validRange);
    
    if (validRange.start.line === validRange.end.line) {
      // Single line deletion
      const line = this.lines[validRange.start.line];
      this.lines[validRange.start.line] = 
        line.substring(0, validRange.start.column) + 
        line.substring(validRange.end.column);
    } else {
      // Multi-line deletion
      const startLine = this.lines[validRange.start.line];
      const endLine = this.lines[validRange.end.line];
      
      // Merge start and end lines
      this.lines[validRange.start.line] = 
        startLine.substring(0, validRange.start.column) + 
        endLine.substring(validRange.end.column);
      
      // Remove lines in between
      this.lines.splice(
        validRange.start.line + 1,
        validRange.end.line - validRange.start.line
      );
    }
    
    this._version++;
    return deletedText;
  }

  /**
   * Replace text in a specific range
   */
  replaceText(range: Range, text: string): Range {
    this.deleteText(range);
    return this.insertText(range.start, text);
  }

  /**
   * Validate and clamp position to document bounds
   */
  validatePosition(position: Position): Position {
    const line = Math.max(0, Math.min(position.line, this.lines.length - 1));
    const maxColumn = this.lines[line].length;
    const column = Math.max(0, Math.min(position.column, maxColumn));
    
    return { line, column };
  }

  /**
   * Validate and clamp range to document bounds
   */
  validateRange(range: Range): Range {
    const start = this.validatePosition(range.start);
    const end = this.validatePosition(range.end);
    
    // Ensure start comes before end
    if (start.line > end.line || (start.line === end.line && start.column > end.column)) {
      return { start: end, end: start };
    }
    
    return { start, end };
  }

  /**
   * Get word range at position
   */
  getWordRangeAtPosition(position: Position, wordPattern?: RegExp): Range | null {
    const validPosition = this.validatePosition(position);
    const line = this.lines[validPosition.line];
    
    if (!line || validPosition.column >= line.length) {
      return null;
    }
    
    const pattern = wordPattern || /\w+/g;
    let match: RegExpExecArray | null;
    
    while ((match = pattern.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      
      if (validPosition.column >= start && validPosition.column <= end) {
        return {
          start: { line: validPosition.line, column: start },
          end: { line: validPosition.line, column: end }
        };
      }
    }
    
    return null;
  }

  /**
   * Convert offset to position
   */
  offsetToPosition(offset: number): Position {
    let currentOffset = 0;
    
    for (let line = 0; line < this.lines.length; line++) {
      const lineLength = this.getLineLength(line);
      
      if (currentOffset + lineLength > offset) {
        return { line, column: offset - currentOffset };
      }
      
      currentOffset += lineLength;
    }
    
    // If offset is beyond document, return end position
    const lastLine = this.lines.length - 1;
    return { line: lastLine, column: this.lines[lastLine].length };
  }

  /**
   * Convert position to offset
   */
  positionToOffset(position: Position): number {
    const validPosition = this.validatePosition(position);
    let offset = 0;
    
    for (let line = 0; line < validPosition.line; line++) {
      offset += this.getLineLength(line);
    }
    
    return offset + validPosition.column;
  }

  /**
   * Find next occurrence of text
   */
  findNext(searchText: string, startPosition: Position, options: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    regex?: boolean;
  } = {}): Range | null {
    const { caseSensitive = false, wholeWord = false, regex = false } = options;
    let pattern: RegExp;
    
    try {
      if (regex) {
        const flags = caseSensitive ? 'g' : 'gi';
        pattern = new RegExp(searchText, flags);
      } else {
        const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = caseSensitive ? 'g' : 'gi';
        const patternText = wholeWord ? `\\b${escapedText}\\b` : escapedText;
        pattern = new RegExp(patternText, flags);
      }
    } catch {
      return null; // Invalid regex
    }
    
    const startOffset = this.positionToOffset(startPosition);
    const text = this.getText();
    
    pattern.lastIndex = startOffset;
    const match = pattern.exec(text);
    
    if (match) {
      const matchStart = this.offsetToPosition(match.index);
      const matchEnd = this.offsetToPosition(match.index + match[0].length);
      return { start: matchStart, end: matchEnd };
    }
    
    return null;
  }

  /**
   * Find all occurrences of text
   */
  findAll(searchText: string, options: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    regex?: boolean;
  } = {}): Range[] {
    const ranges: Range[] = [];
    let position: Position = { line: 0, column: 0 };
    
    while (true) {
      const range = this.findNext(searchText, position, options);
      if (!range) break;
      
      ranges.push(range);
      position = range.end;
    }
    
    return ranges;
  }
}

/**
 * Implementation of TextDocument interface
 */
export class TextDocumentImpl implements TextDocument {
  private buffer: LineBuffer;

  constructor(
    public readonly uri: string,
    public readonly languageId: string,
    public readonly version: number,
    content: string
  ) {
    this.buffer = new LineBuffer(content);
  }

  get lineCount(): number {
    return this.buffer.lineCount;
  }

  getText(range?: Range): string {
    if (!range) {
      return this.buffer.getText();
    }
    return this.buffer.getTextRange(range);
  }

  getLineContent(line: number): string {
    return this.buffer.getLineContent(line);
  }

  getWordRangeAtPosition(position: Position): Range | null {
    return this.buffer.getWordRangeAtPosition(position);
  }

  validateRange(range: Range): Range {
    return this.buffer.validateRange(range);
  }

  validatePosition(position: Position): Position {
    return this.buffer.validatePosition(position);
  }

  /**
   * Internal method to get the line buffer for editing operations
   */
  getBuffer(): LineBuffer {
    return this.buffer;
  }

  /**
   * Create a new version of this document with changes applied
   */
  applyChanges(changes: Array<{ range: Range; text: string }>): TextDocumentImpl {
    const newBuffer = new LineBuffer(this.buffer.getText(), this.buffer.lineEndings);
    
    // Sort changes by position (reverse order to maintain indices)
    const sortedChanges = [...changes].sort((a, b) => {
      if (a.range.start.line !== b.range.start.line) {
        return b.range.start.line - a.range.start.line;
      }
      return b.range.start.column - a.range.start.column;
    });
    
    // Apply changes in reverse order
    for (const change of sortedChanges) {
      newBuffer.replaceText(change.range, change.text);
    }
    
    return new TextDocumentImpl(
      this.uri,
      this.languageId,
      this.version + 1,
      newBuffer.getText()
    );
  }
}