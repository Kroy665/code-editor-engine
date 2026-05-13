import { Position, Range, TextDocument } from '../types/core';

/**
 * Bracket pair configuration
 */
export interface BracketPair {
    readonly open: string;
    readonly close: string;
}

/**
 * Auto-closing pair configuration
 */
export interface AutoClosingPair extends BracketPair {
    readonly notIn?: ('string' | 'comment')[];
}

/**
 * Bracket match result
 */
export interface BracketMatch {
    readonly open: Range;
    readonly close: Range;
    readonly bracketPair: BracketPair;
}

/**
 * Default bracket pairs for common languages
 */
export const DEFAULT_BRACKETS: BracketPair[] = [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '<', close: '>' },
];

/**
 * Default auto-closing pairs
 */
export const DEFAULT_AUTO_CLOSING_PAIRS: AutoClosingPair[] = [
    { open: '(', close: ')', notIn: ['string', 'comment'] },
    { open: '[', close: ']', notIn: ['string', 'comment'] },
    { open: '{', close: '}', notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string', 'comment'] },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '`', close: '`', notIn: ['string', 'comment'] },
];

/**
 * Bracket matcher for finding matching brackets
 */
export class BracketMatcher {
    private brackets: BracketPair[];
    private openBrackets = new Map<string, BracketPair>();
    private closeBrackets = new Map<string, BracketPair>();

    constructor(brackets: BracketPair[] = DEFAULT_BRACKETS) {
        this.brackets = brackets;
        this.buildBracketMaps();
    }

    private buildBracketMaps(): void {
        this.openBrackets.clear();
        this.closeBrackets.clear();

        for (const pair of this.brackets) {
            this.openBrackets.set(pair.open, pair);
            this.closeBrackets.set(pair.close, pair);
        }
    }

    /**
     * Update bracket pairs
     */
    setBrackets(brackets: BracketPair[]): void {
        this.brackets = brackets;
        this.buildBracketMaps();
    }

    /**
     * Find matching bracket for the bracket at the given position
     */
    findMatchingBracket(document: TextDocument, position: Position): BracketMatch | null {
        const char = this.getCharAt(document, position);
        if (!char) return null;

        // Check if it's an opening bracket
        const openPair = this.openBrackets.get(char);
        if (openPair) {
            return this.findClosingBracket(document, position, openPair);
        }

        // Check if it's a closing bracket
        const closePair = this.closeBrackets.get(char);
        if (closePair) {
            return this.findOpeningBracket(document, position, closePair);
        }

        return null;
    }

    /**
     * Find all bracket pairs in a range
     */
    findBracketsInRange(document: TextDocument, range?: Range): BracketMatch[] {
        const matches: BracketMatch[] = [];
        const startLine = range?.start.line || 0;
        const endLine = range?.end.line || document.lineCount - 1;

        for (let line = startLine; line <= endLine; line++) {
            const lineText = document.getLineContent(line);

            for (let col = 0; col < lineText.length; col++) {
                const char = lineText[col];
                const pair = this.openBrackets.get(char);

                if (pair) {
                    const match = this.findClosingBracket(
                        document,
                        { line, column: col },
                        pair,
                    );
                    if (match) {
                        matches.push(match);
                    }
                }
            }
        }

        return matches;
    }

    /**
     * Check if position is inside brackets
     */
    isInsideBrackets(document: TextDocument, position: Position): boolean {
        const match = this.findSurroundingBrackets(document, position);
        return match !== null;
    }

    /**
     * Find the innermost bracket pair surrounding a position
     */
    findSurroundingBrackets(document: TextDocument, position: Position): BracketMatch | null {
        let closestMatch: BracketMatch | null = null;
        let closestDistance = Infinity;

        // Search backwards from position
        for (let line = position.line; line >= 0; line--) {
            const lineText = document.getLineContent(line);
            const startCol = line === position.line ? position.column - 1 : lineText.length - 1;

            for (let col = startCol; col >= 0; col--) {
                const char = lineText[col];
                const pair = this.openBrackets.get(char);

                if (pair) {
                    const match = this.findClosingBracket(document, { line, column: col }, pair);

                    if (match && this.isPositionInRange(position, match.open, match.close)) {
                        const distance =
                            (position.line - match.open.start.line) * 1000 +
                            (position.column - match.open.start.column);

                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestMatch = match;
                        }
                    }
                }
            }
        }

        return closestMatch;
    }

    private findClosingBracket(
        document: TextDocument,
        position: Position,
        pair: BracketPair,
    ): BracketMatch | null {
        let depth = 1;
        let { line, column } = position;

        // Move to next character
        column++;

        while (line < document.lineCount) {
            const lineText = document.getLineContent(line);

            while (column < lineText.length) {
                const char = lineText[column];

                if (char === pair.open) {
                    depth++;
                } else if (char === pair.close) {
                    depth--;
                    if (depth === 0) {
                        return {
                            open: {
                                start: position,
                                end: { line: position.line, column: position.column + 1 },
                            },
                            close: {
                                start: { line, column },
                                end: { line, column: column + 1 },
                            },
                            bracketPair: pair,
                        };
                    }
                }

                column++;
            }

            line++;
            column = 0;
        }

        return null;
    }

    private findOpeningBracket(
        document: TextDocument,
        position: Position,
        pair: BracketPair,
    ): BracketMatch | null {
        let depth = 1;
        let { line, column } = position;

        // Move to previous character
        column--;

        while (line >= 0) {
            const lineText = document.getLineContent(line);

            while (column >= 0) {
                const char = lineText[column];

                if (char === pair.close) {
                    depth++;
                } else if (char === pair.open) {
                    depth--;
                    if (depth === 0) {
                        return {
                            open: {
                                start: { line, column },
                                end: { line, column: column + 1 },
                            },
                            close: {
                                start: position,
                                end: { line: position.line, column: position.column + 1 },
                            },
                            bracketPair: pair,
                        };
                    }
                }

                column--;
            }

            line--;
            if (line >= 0) {
                column = document.getLineContent(line).length - 1;
            }
        }

        return null;
    }

    private getCharAt(document: TextDocument, position: Position): string | null {
        if (position.line >= document.lineCount) return null;

        const lineText = document.getLineContent(position.line);
        if (position.column >= lineText.length) return null;

        return lineText[position.column];
    }

    private isPositionInRange(position: Position, start: Range, end: Range): boolean {
        // Check if position is after open bracket
        if (
            position.line < start.end.line ||
            (position.line === start.end.line && position.column < start.end.column)
        ) {
            return false;
        }

        // Check if position is before close bracket
        if (
            position.line > end.start.line ||
            (position.line === end.start.line && position.column > end.start.column)
        ) {
            return false;
        }

        return true;
    }
}

/**
 * Auto-closing pairs manager
 */
export class AutoClosingPairsManager {
    private pairs: AutoClosingPair[];
    private openChars = new Set<string>();
    private pairMap = new Map<string, AutoClosingPair>();

    constructor(pairs: AutoClosingPair[] = DEFAULT_AUTO_CLOSING_PAIRS) {
        this.pairs = pairs;
        this.buildPairMaps();
    }

    private buildPairMaps(): void {
        this.openChars.clear();
        this.pairMap.clear();

        for (const pair of this.pairs) {
            this.openChars.add(pair.open);
            this.pairMap.set(pair.open, pair);
        }
    }

    /**
     * Update auto-closing pairs
     */
    setPairs(pairs: AutoClosingPair[]): void {
        this.pairs = pairs;
        this.buildPairMaps();
    }

    /**
     * Check if character should trigger auto-closing
     */
    shouldAutoClose(char: string, context?: { inString?: boolean; inComment?: boolean }): boolean {
        if (!this.openChars.has(char)) return false;

        const pair = this.pairMap.get(char);
        if (!pair || !pair.notIn) return true;

        // Check context restrictions
        if (context?.inString && pair.notIn.includes('string')) return false;
        if (context?.inComment && pair.notIn.includes('comment')) return false;

        return true;
    }

    /**
     * Get closing character for opening character
     */
    getClosingChar(openChar: string): string | null {
        const pair = this.pairMap.get(openChar);
        return pair ? pair.close : null;
    }

    /**
     * Check if we should skip over a closing character
     */
    shouldSkipClosing(
        char: string,
        document: TextDocument,
        position: Position,
    ): boolean {
        // Get next character
        const lineText = document.getLineContent(position.line);
        const nextChar = lineText[position.column];

        // Check if next character matches what we're typing
        if (nextChar !== char) return false;

        // Check if this is a closing character
        for (const pair of this.pairs) {
            if (pair.close === char && pair.open === char) {
                // For symmetric pairs (like quotes), count them
                return this.shouldSkipSymmetricPair(char, lineText, position.column);
            } else if (pair.close === char) {
                return true;
            }
        }

        return false;
    }

    private shouldSkipSymmetricPair(char: string, lineText: string, column: number): boolean {
        // Count occurrences before cursor
        let count = 0;
        for (let i = 0; i < column; i++) {
            if (lineText[i] === char) count++;
        }

        // If odd number before cursor, we're closing
        return count % 2 === 1;
    }

    /**
     * Get all auto-closing pairs
     */
    getPairs(): readonly AutoClosingPair[] {
        return this.pairs;
    }
}
