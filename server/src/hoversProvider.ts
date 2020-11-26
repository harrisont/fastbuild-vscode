import {
	Hover,
	HoverParams,
	MarkupKind,
} from 'vscode-languageserver';

import {
	SourceRange,
} from './parser'

import {
	EvaluatedData,
} from './evaluator';

export class HoverProvider {
	private evaluatedData: EvaluatedData | null = null;

	onEvaluatedDataChanged(newEvaluatedData: EvaluatedData): void {
		this.evaluatedData = newEvaluatedData;
	}
	
	onHover(params: HoverParams): Hover | null {
		const position = params.position;
		const evaluatedVariables = this.evaluatedData?.evaluatedVariables ?? [];
	
		for (let i = 0; i < evaluatedVariables.length; i++)
		{
			const evaluatedVariable = evaluatedVariables[i];
			const range = evaluatedVariable.range;
			// TODO: also match params.textDocument.uri
			if (SourceRange.isPositionInRange(position, evaluatedVariable.range))
			{
				const value = evaluatedVariable.value;
				
				const hoverText = JSON.stringify(value);
	
				const hover: Hover = {
					contents: {
						kind: MarkupKind.PlainText,
						value: hoverText
					},
					range: evaluatedVariable.range
				}
				return hover;
			}
		}

		return null;
	}
}