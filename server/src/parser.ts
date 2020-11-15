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
	parser.feed(text);

	//parser.results

	/*const parsedString: ParsedString = {
		raw: raw,
		evaluated: evaluated,
		range: {
			line: line,
			characterStart: valueIndexStart,
			characterEnd: valueIndexEnd
		}
	};
	*/
	
	return {
		strings: []
	};
}