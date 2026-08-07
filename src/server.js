import { createApp } from "./app.js";
import { serverConfig } from "./config/application.js";

const app = createApp();

app.listen(serverConfig.port, serverConfig.host, () => {
  console.log(
    `CSMS JavaScript application running at ` +
      `http://${serverConfig.host}:${serverConfig.port}`
  );
});