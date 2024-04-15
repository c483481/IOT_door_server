import { Server } from "socket.io";
import { createServer } from "http";
import Validator, {
  AsyncCheckFunction,
  SyncCheckFunction,
} from "fastest-validator";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { instrument } from "@socket.io/admin-ui";

const app = express();
app.use(
  helmet({
    frameguard: {
      action: "deny",
    },
    dnsPrefetchControl: false,
  })
);

app.use(
  cors({
    origin: ["*", "https://admin.socket.io"],
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  })
);

app.use(express.urlencoded({ extended: false, limit: "50kb" }));
app.use(express.json({ limit: "50kb" }));

function handleRequest(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();
  const { method, originalUrl } = req;
  res.on("finish", () => {
    const { statusCode } = res;
    const end = performance.now();
    console.log(
      `${method} ${originalUrl} ${statusCode} ${Math.round(end - start)}ms`
    );
  });
  next();
}

function handleNotFound(
  req: Request,
  res: Response,
  _next: NextFunction
): Response | void {
  if (!res.headersSent) {
    return res.status(404).json({
      success: false,
      code: "Not Found",
      message: `Not Found path ${req.originalUrl}`,
    });
  }
}

app.use(handleRequest);

app.get("/", (_req: Request, res: Response): Response => {
  return res.status(200).json({
    success: true,
    message: "OK",
    data: {
      appName: "Smart Lock Api",
      version: "0.0.0",
    },
  });
});

app.use(handleNotFound);

const http = createServer(app);

export const baseValidator = new Validator({ haltOnFirstError: true });

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

const io = new Server(http, {
  cors: {
    origin: ["*", "https://admin.socket.io"],
    credentials: true,
  },
});

let state = false;

interface JoinDevicePayload {
  key: string;
  type: string;
}

instrument(io, {
  namespaceName: "/monitoring",
  auth: {
    type: "basic",
    username: "quen",
    password: "$2a$10$5JspB6420u5NCcRjfx/QaO7FLkvEtrCtCqnX0/F4fdJQx4qka36xm", // qwert12345
  },
  readonly: true,
  mode: "production",
});

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

http.listen(3000, () => {
  console.log("running on port 3000");
});
