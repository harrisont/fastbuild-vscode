//
// The VS Code language server.
//

import {
    Server
} from './server';

import {
    createConnection,
    ProposedFeatures,
    TextDocuments,
} from 'vscode-languageserver';

import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);

// Create and run the server.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const server = new Server(connection, documents);