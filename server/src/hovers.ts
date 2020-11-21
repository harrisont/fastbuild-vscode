import {
	Connection,
	Hover,
	HoverParams,
	MarkupKind,
} from 'vscode-languageserver';

import * as evaluator from './evaluator'

interface State {
	parsedData: evaluator.ParsedData | null
}

let state: State = {
	parsedData: null
};

export function configure(connection: Connection): void {
	connection.onHover(onHover);
}

export function onParsedDataChanged(newParsedData: evaluator.ParsedData): void {
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
			
			const hoverText = JSON.stringify(value);

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