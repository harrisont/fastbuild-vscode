import {
	Connection,
	Hover,
	HoverParams,
	MarkupKind,
} from 'vscode-languageserver';

import * as parser from './parser'

interface State {
	parsedData: parser.ParsedData | null
}

let state: State = {
	parsedData: null
};

export function configure(connection: Connection): void {
	connection.onHover(onHover);
}

export function onParsedDataChanged(newParsedData: parser.ParsedData): void {
	state.parsedData = newParsedData;
}

function onHover(params: HoverParams) {
	const position = params.position;
	const evaluatedVariables = state.parsedData?.evaluatedVariables ?? [];

	for (let i = 0; i < evaluatedVariables.length; i++)
    {
		const range = evaluatedVariables[i].range;
        if (range.line == position.line
           && (range.characterStart <= position.character && range.characterEnd >= position.character))
        {
			const value = evaluatedVariables[i].value;
			
			let hoverText = '';
			if (value instanceof Array) {
				hoverText = `[${value.toString()}]`
			} else {
				hoverText = String(value);
			}

			const hover: Hover = {
				contents: {
					kind: MarkupKind.PlainText,
					value: hoverText
				},
				range: {
					start: {
						line: range.line,
						character: range.characterStart,
					},
					end: {
						line: range.line,
						character: range.characterEnd
					}
				}
			}
			return hover;
        }
    }
}