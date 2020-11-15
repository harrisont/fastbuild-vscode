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
	const strings = state.parsedData?.strings ?? [];

	for (let i = 0; i < strings.length; i++)
    {
		const range = strings[i].range;
        if (range.line == position.line
           && (range.characterStart <= position.character && range.characterEnd >= position.character))
        {
			const hoverText = strings[i].evaluated;

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