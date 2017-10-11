import * as path from "path";
import { commands, workspace, Disposable, ExtensionContext } from "vscode";
import {
  LanguageClient, LanguageClientOptions,
  SettingMonitor, ServerOptions,
  TransportKind, RequestType
} from "vscode-languageclient";
import { Config, CONFIG_BLOCK_NAME } from "./utils/config";

const SERVER_PATH = path.join("server", "server.js");

export interface BuildFromFilesParam {
  files: string[];
}

const BuildFromFilesRequestType =
  new RequestType<BuildFromFilesParam, void, void, void>("buildFromFiles");

export default class RFServerClient implements Disposable {
  private _client: LanguageClient;
  private _context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this._context = context;
  }

  public dispose() {
    this.stop();
  }

  public start() {
    if (this._client) {
      throw new Error("Client already running");
    }

    this._client = this._createClient();
    this._client.start();

    return this._client.onReady();
  }

  public restart() {
    return this.stop()
      .then(() => this.start());
  }

  public stop() {
    if (this._client) {
      const stopPromise = this._client.stop();
      this._client = null;

      return stopPromise;
    } else {
      return Promise.resolve();
    }
  }

  public sendBuildFilesRequest(files) {
    this._client.onReady().then(() => {
      this._client.sendRequest(BuildFromFilesRequestType, {
        files
      });
    });
  }

  private _createClient(): LanguageClient {
    // The server is implemented in node
    const serverModule = this._context.asAbsolutePath(SERVER_PATH);
    // The debug options for the server
    const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

    const include = Config.getInclude();

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions: ServerOptions = {
      run:   { module: serverModule, transport: TransportKind.ipc },
      debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for robot documents
      documentSelector: ["robot"],
      synchronize: {
        // Synchronize the setting section to the server
        configurationSection: CONFIG_BLOCK_NAME,
        fileEvents: workspace.createFileSystemWatcher(include)
      }
    };

    return new LanguageClient(
      "rfLanguageServer",
      "Robot Framework Intellisense Server",
      serverOptions,
      clientOptions,
      true
    );
  }
}
