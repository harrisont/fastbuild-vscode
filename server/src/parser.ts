import * as nearley from 'nearley'
import fbuildGrammar from './fbuild-grammar'

export interface ParsedRange
{
	line: number,
	characterStart: number,
	characterEnd: number
}

export interface ParsedString
{
	range: ParsedRange

	// The raw string value without evaluating variables.
	raw: string

	// The value of the string after evaluating variables.
	evaluated: string
}

export interface ParsedData {
	strings: ParsedString[]
}

export type QuoteChar = '\'' | '"'

export function parse(text: string): ParsedData {
	const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
	parser.feed(`
//
// Root FASTBuild file for the KeystoneFoundation depot.
//
`);

	//======================================================================

	let strings: ParsedString[] = [];

	const chars = [...text];
	let line = 0;
	let lineCharIndex = 0;
	let isInString = false;
	let valueIndexStart = 0;
	let value = "";
	let stringBoundaryChar: QuoteChar | null = null; 
	chars.forEach(char => {
		if (char == "\n") {
			++line;
			// -1 because we always add 1 at the end of the loop.
			lineCharIndex = -1;
		} else if ((char == "'" || char == "\"") &&
				   !isInString || char == stringBoundaryChar)
		{
			if (!isInString) {
				// Starting a string
				isInString = true;
				valueIndexStart = lineCharIndex + 1;
				stringBoundaryChar = char;
			} else if (char == stringBoundaryChar) {
				// Ending a string
				const raw = value;
				const evaluated = "TODO:" + raw;
				const valueIndexEnd = lineCharIndex;
				const parsedString: ParsedString = {
					raw: raw,
					evaluated: evaluated,
					range: {
						line: line,
						characterStart: valueIndexStart,
						characterEnd: valueIndexEnd
					}
				};
				strings.push(parsedString);

				isInString = false;
				value = "";
				stringBoundaryChar = null;
			}
		} else if (isInString) {
			value += char;
		}

		++lineCharIndex;
	});

	return {
		strings: strings
	};
}