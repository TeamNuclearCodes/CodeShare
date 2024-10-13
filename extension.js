const vscode = require("vscode");
const { Server } = require("socket.io");
const cors = require("cors");
const express = require("express");
const http = require("http"); // Add this line to import http

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const app = express();

  app.use(express.json());
  app.use(cors());

  const server = http.createServer(app);

  // Setting up Socket.io with CORS
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected");
    socket.on("join", (room) => socket.join(room));
    socket.on("ping", () => console.log(12));
    socket.on("reqFileSystem", () => fileSystemRetreive(socket));
    socket.on("reqFileContent", (name) => {
      console.log(`getting contents of ${name}`);
      getFileContent(socket, name);
    });
  });

  // Start the Express server on port 5000
  server.listen(5000, async () => {
    console.log("App running at port 5000");
  });

  console.log('Congratulations, your extension "codeshare" is now active!');

  // Register a VS Code command
  const disposable = vscode.commands.registerCommand(
    "codeshare.helloWorld",
    function () {
      vscode.window.showInformationMessage("Hello World from CodeShare!");
    }
  );

  // Push disposables to context subscriptions
  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

const getFileContent = async (socket, name) => {
  console.log("inside getFileContent");
  try {
    const path = await getFileUri(name);
    const doc = await vscode.workspace.openTextDocument(path);
    const text = doc.getText();
    console.log("Contents read"); // optional
    socket.emit("sendFileContent", text);
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error}`);
  }
};

const getFileUri = async (name) => {
  try {
    console.log("inside getFileUri");
    const files = await vscode.workspace.findFiles(`**/${name}`);
    if (files.length > 0) {
      const fileUri = files[0];
      console.log(`File found: ${fileUri.fsPath}`);
      return fileUri;
    } else {
      vscode.window.showErrorMessage(`File "${filename}" not found.`);
      return null;
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error}`);
  }
};

const fileSystemRetreive = async (socket) => {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const folderUri = workspaceFolders[0].uri;
      const files = await folderSearch(folderUri);
      console.log(files);
      socket.emit("sendFileSystem", files);
      vscode.window.showInformationMessage("Files fetched from the workspace!");
    } else {
      vscode.window.showInformationMessage("No workspace folder found.");
    }
  } catch (error) {
    console.error("Error reading directory:", error);
    vscode.window.showErrorMessage("Error reading the workspace folder.");
  }
};

const folderSearch = async (uri) => {
  const files = await vscode.workspace.fs.readDirectory(uri);
  let subFolder = {};
  const formattedFiles = await Promise.all(
    files.map(async ([name, type]) => {
      if (type === vscode.FileType.Directory) {
        const newUri = vscode.Uri.joinPath(uri, name);
        subFolder = await folderSearch(newUri);
      }
      return {
        name: name,
        isFolder: type === vscode.FileType.Directory,
        opened: false,
        subFolder: subFolder,
      };
    })
  );
  return formattedFiles;
};
