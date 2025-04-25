"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http")); // Import http module
const proxy_1 = __importDefault(require("./server/routes/proxy")); // Import the proxy router function
const errorHandler_1 = __importDefault(require("./server/middlewares/errorHandler")); // Import error handler middleware
const ApiKeyManager_1 = __importDefault(require("./server/core/ApiKeyManager")); // Import ApiKeyManager
const RequestDispatcher_1 = __importDefault(require("./server/core/RequestDispatcher")); // Import RequestDispatcher
const GoogleApiForwarder_1 = __importDefault(require("./server/core/GoogleApiForwarder")); // Import GoogleApiForwarder
const StreamHandler_1 = require("./server/core/StreamHandler"); // Import StreamHandler
// We might not need loggerMiddleware directly in extension.ts, but the errorHandler uses the logger.
// Let's keep the import for now or ensure the logger is accessible.
// import { loggerMiddleware } from './server/middlewares/logger';
let server; // Declare server variable to manage its lifecycle
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    console.log('Roo: activate function started'); // Added log to check activation
    console.log('Congratulations, your extension "api-key-aggregetor" is now active!');
    // --- Start Proxy Server Integration ---
    const app = (0, express_1.default)();
    // Use a fixed port for now to test server startup
    const port = 3300; // Hardcoded port for testing
    // Create instances of dependencies
    const apiKeyManager = new ApiKeyManager_1.default();
    const googleApiForwarder = new GoogleApiForwarder_1.default();
    const streamHandler = new StreamHandler_1.StreamHandler();
    const requestDispatcher = new RequestDispatcher_1.default(apiKeyManager);
    // Create the proxy router
    const proxyRouter = (0, proxy_1.default)(apiKeyManager, requestDispatcher, googleApiForwarder, streamHandler);
    // Integrate JSON body parser middleware
    app.use(express_1.default.json({ limit: '8mb' }));
    // Integrate proxy router
    app.use('/', proxyRouter);
    // Integrate unified error handling middleware (should be after routes)
    app.use(errorHandler_1.default); // Assuming errorHandler is adapted or can access necessary dependencies
    // Start the HTTP server
    server = http_1.default.createServer(app);
    server.listen(port, () => {
        console.log(`Proxy server is running on port ${port}`);
        vscode.window.showInformationMessage(`API Key Aggregator Proxy Server started on port ${port}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use.`);
            vscode.window.showErrorMessage(`Port ${port} is already in use. Please configure a different port for the API Key Aggregator extension.`);
        }
        else {
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
function deactivate() {
    console.log('Your extension "api-key-aggregetor" is being deactivated.');
    // The server is closed via context.subscriptions.dispose
}
//# sourceMappingURL=extension.js.map