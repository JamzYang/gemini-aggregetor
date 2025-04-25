// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import express from 'express';
import http from 'http'; // Import http module
import config from './server/config'; // Import config from the copied server code
import createProxyRouter from './server/routes/proxy'; // Import the proxy router function
import errorHandler from './server/middlewares/errorHandler'; // Import error handler middleware
import ApiKeyManager from './server/core/ApiKeyManager'; // Import ApiKeyManager
import RequestDispatcher from './server/core/RequestDispatcher'; // Import RequestDispatcher
import GoogleApiForwarder from './server/core/GoogleApiForwarder'; // Import GoogleApiForwarder
import { StreamHandler } from './server/core/StreamHandler'; // Import StreamHandler
// We might not need loggerMiddleware directly in extension.ts, but the errorHandler uses the logger.
// Let's keep the import for now or ensure the logger is accessible.
// import { loggerMiddleware } from './server/middlewares/logger';

let server: http.Server | undefined; // Declare server variable to manage its lifecycle

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('Roo: activate function started'); // Added log to check activation

	console.log('Congratulations, your extension "api-key-aggregetor" is now active!');

	// --- Start Proxy Server Integration ---

	const app = express();
	// Use a fixed port for now to test server startup
	const port = 3300; // Hardcoded port for testing

	// Create instances of dependencies
	const apiKeyManager = new ApiKeyManager();
	const googleApiForwarder = new GoogleApiForwarder();
	const streamHandler = new StreamHandler();
	const requestDispatcher = new RequestDispatcher(apiKeyManager);

	// Create the proxy router
	const proxyRouter = createProxyRouter(apiKeyManager, requestDispatcher, googleApiForwarder, streamHandler);

	// Integrate JSON body parser middleware
	app.use(express.json({ limit: '8mb' }));

	// Integrate proxy router
	app.use('/', proxyRouter);

	// Integrate unified error handling middleware (should be after routes)
	app.use(errorHandler); // Assuming errorHandler is adapted or can access necessary dependencies

	// Start the HTTP server
	server = http.createServer(app);

	server.listen(port, () => {
		console.log(`Proxy server is running on port ${port}`);
		vscode.window.showInformationMessage(`API Key Aggregator Proxy Server started on port ${port}`);
	}).on('error', (err: any) => {
		if (err.code === 'EADDRINUSE') {
			console.error(`Port ${port} is already in use.`);
			vscode.window.showErrorMessage(`Port ${port} is already in use. Please configure a different port for the API Key Aggregator extension.`);
		} else {
			console.error('Failed to start proxy server:', err);
			vscode.window.showErrorMessage(`Failed to start API Key Aggregator Proxy Server: ${err.message}`);
		}
		// Deactivate the extension if the server fails to start
		deactivate();
	});

	// Add the server to the context subscriptions so it's disposed on deactivate
	context.subscriptions.push({
		dispose: () => {
			if (server) {
				server.close(() => {
					console.log('Proxy server stopped.');
				});
			}
		}
	});

	// --- End Proxy Server Integration ---

	// Example command from the template (can be removed later)
	const disposable = vscode.commands.registerCommand('api-key-aggregetor.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from api-key-aggregetor!');
	});
	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Your extension "api-key-aggregetor" is being deactivated.');
	// The server is closed via context.subscriptions.dispose
}
