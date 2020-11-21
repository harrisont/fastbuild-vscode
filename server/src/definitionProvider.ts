import {
	Connection,
} from 'vscode-languageserver';

import {
	DefinitionParams
} from 'vscode-languageserver-protocol';

import {
	DocumentUri
} from 'vscode-languageserver-types';

import * as evaluator from './evaluator'

export class DefinitionProvider {
	private parsedData: evaluator.ParsedData | null = null;

	onParsedDataChanged(uri: DocumentUri, newParsedData: evaluator.ParsedData): void {
		this.parsedData = newParsedData;
	}

	onDefinition(params: DefinitionParams) {
		return null;
		//const definition: DefinitionLink = {
		//	originSelectionRange: Range;
		//	targetUri: DocumentUri;
		//	targetRange: Range;
		//	targetSelectionRange: Range;
		//}
		//return definition;
	}
}