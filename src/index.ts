import { Server } from "socket.io";
import { createServer } from "http";
import Validator, {
  AsyncCheckFunction,
  SyncCheckFunction,
} from "fastest-validator";

export const baseValidator = new Validator({ haltOnFirstError: true });

let status = false;

function safeValidate(
  fn: AsyncCheckFunction | SyncCheckFunction,
  data: unknown
): boolean {
  const err = fn(data);
  if (err !== true) {
    return false;
  }
  return true;
}

function compareString(str1: string, str2: string): boolean {
  if (!str1 || !str2 || typeof str1 !== "string" || typeof str2 !== "string") {
    return false;
  }

  if (str1.length !== str2.length) {
    return false;
  }

  for (let i = 0; i < str1.length; i++) {
    if (!(str1.charCodeAt(i) === str2.charCodeAt(i))) {
      return false;
    }
  }

  return true;
}

const keyDevice = "qwert12345";

const devicePayloadScema = baseValidator.compile({
  key: "string|empty:false|required|max:20",
  type: {
    type: "enum",
    values: ["device", "mobile"],
    require: true,
  },
  $$strict: true,
});

const server = createServer();
const io = new Server(server);

let state = false;

interface JoinDevicePayload {
  key: string;
  type: string;
}

interface SendPayload {
  type: string;
}

io.on("connection", (socket) => {
  socket.on("join", (payload: JoinDevicePayload) => {
    if (!safeValidate(devicePayloadScema, payload)) {
      return socket.emit("joined", false);
    }

    if (!compareString(payload.key, keyDevice)) {
      return socket.emit("joined", false);
    }

    console.log(`socket connected id: ${socket.id} type: ${payload.type}`);
    socket.join(payload.type);
    if (payload.type === "mobile") {
      socket.emit("status", state);
    }
    return socket.emit("joined", true);
  });

  socket.on("send", () => {
    const roomsArr = Array.from(socket.rooms);
    const roomsName = roomsArr[1];

    if (roomsName !== "mobile") {
      return;
    }

    return socket.to("device").emit("open");
  });

  socket.on("buka", () => {
    const roomsArr = Array.from(socket.rooms);
    const roomsName = roomsArr[1];

    if (roomsName !== "device") {
      return;
    }
    state = true;
    return socket.to("mobile").emit("status", state);
  });

  socket.on("tutup", () => {
    const roomsArr = Array.from(socket.rooms);
    const roomsName = roomsArr[1];

    if (roomsName !== "device") {
      return;
    }

    state = false;

    return socket.to("mobile").emit("status", state);
  });
});

server.listen(3000, () => {
  console.log("running on port 3000");
});
