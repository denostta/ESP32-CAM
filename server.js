const path = require("path");
const express = require("express");
const WebSocket = require("ws");

const app = express();

app.use("/static", express.static(path.join(__dirname, "public")));

let clients = [];

// const HTTP_PORT = 8001;
const HTTP_PORT = process.env.PORT || 8001;
let devices = {
  relay_module1: { port: 8888 },
};

process.on("uncaughtException", (error, origin) => {
  console.log("----- Uncaught exception -----");
  console.log(error);
  console.log("----- Exception origin -----");
  console.log(origin);
  console.log("----- Status -----");
});

// Clients
const wss = new WebSocket.Server({ port: "9000" }, () =>
  console.log(`WS Server is listening at 9000`)
);

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    if (ws.readyState !== ws.OPEN) return;
    clients.push(ws);

    try {
      data = JSON.parse(data);

      if (data.operation === "command") {
        if (devices[data.command.recipient]) {
          devices[data.command.recipient].command =
            data.command.message.key + "=" + data.command.message.value;
        }
      }
    } catch (error) {}
  });
});

// Devices
Object.entries(devices).forEach(([key]) => {
  const device = devices[key];

  new WebSocket.Server({ port: device.port }, () =>
    console.log(`WS Server is listening at ${device.port}`)
  ).on("connection", (ws) => {
    ws.on("message", (data) => {
      if (ws.readyState !== ws.OPEN) return;

      if (device.command) {
        ws.send(device.command);
        device.command = null; // Consume
      }

      if (typeof data === "object") {
        device.image = Buffer.from(Uint8Array.from(data)).toString("base64");
      } else {
        device.peripherals = data.split(",").reduce((acc, item) => {
          const key = item.split("=")[0];
          const value = item.split("=")[1];
          acc[key] = value;
          return acc;
        }, {});
      }

      clients.forEach((client) => {
        client.send(JSON.stringify({ devices: devices }));
      });
    });
  });
});

app.get("/client", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "./public/client.html"));
});
// app.listen(HTTP_PORT, () => {
//   console.log(`HTTP server starting on ${HTTP_PORT}`);
// });
