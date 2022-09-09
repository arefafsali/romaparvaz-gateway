import * as http from "http";
import * as debug from "debug";
import DataAccess = require("./Repositories/Base/DataAccess");
const chalk = require("chalk");
const globalLog = require("global-request-logger");
require("dotenv").config();

import App from "./app";
import { json } from "body-parser";
import { EurekaHelper } from "./Repositories/Utility/EurekaHelper";
console.log(process.env.NODE_ENV);
if (process.env.DEV_MODE && false) {
  globalLog.initialize();
  globalLog.on("success", function (request, response) {
    console.log(
      chalk.bgWhite(chalk.black("EXTERNAL REQUEST ") + chalk.green("SUCCESS"))
    );
    delete request.body;
    delete response.body;
    console.log(
      chalk.bgWhite(
        chalk.black("Request"),
        chalk.cyan(JSON.stringify(request, null, 2))
      )
    );
    console.log(
      chalk.bgWhite(
        chalk.black("Response"),
        chalk.cyan(JSON.stringify(response, null, 2))
      )
    );
  });

  globalLog.on("error", function (request, response) {
    console.log(
      chalk.bgWhite(chalk.black("EXTERNAL REQUEST ") + chalk.red("ERROR"))
    );
    delete request.body;
    // delete response.body;
    console.log(
      chalk.bgRedBright(
        chalk.bold.yellowBright("Request"),
        chalk.white(JSON.stringify(request, null, 2))
      )
    );
    console.log(
      chalk.bgRedBright(
        chalk.bold.yellowBright("Response"),
        chalk.white(JSON.stringify(response, null, 2))
      )
    );
  });
}

debug("ts-express:server");
var server;
var port;
(async function () {
  await DataAccess.test();
  port = normalizePort(process.env.PORT || 3000);
  App.set("port", port);
  server = http.createServer(App);
  server.listen(port);
  // console.log(server);
  server.on("error", onError);
  server.on("listening", onListening);
})();

function normalizePort(val: number | string): number | string | boolean {
  let port: number = typeof val === "string" ? parseInt(val, 10) : val;
  if (isNaN(port)) return val;
  else if (port >= 0) return port;
  else return false;
}

function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== "listen") throw error;
  let bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
  switch (error.code) {
    case "EACCES":
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening(): void {
  let addr = server.address();
  let bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr.port}`;
  console.log(chalk.bold.yellow("Server is available on port " + port));
  debug(`Listening on ${bind}`);
  if (process.env.EUREKA_CONNECT) EurekaHelper.Register();
}

module.exports = server;
