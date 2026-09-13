import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";

const apiOrigin = __ENV.LOAD_API_URL;
if (!apiOrigin) throw new Error("LOAD_API_URL is required.");

export const options = {
  scenarios: {
    public_api: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 25 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
};

export default function () {
  const ready = http.get(`${apiOrigin}/api/v1/ready`);
  check(ready, { "API ready": (response) => response.status === 200 });

  const drinks = http.get(`${apiOrigin}/api/v1/drinks`);
  check(drinks, { "drink listing succeeds": (response) => response.status < 500 });
  sleep(1);
}

export function socketSmoke() {
  const socketOrigin = apiOrigin.replace(/^http/, "ws");
  const response = ws.connect(`${socketOrigin}/socket.io/?EIO=4&transport=websocket`, {}, (socket) => {
    socket.setTimeout(() => socket.close(), 2_000);
  });
  check(response, { "Socket.IO upgrade succeeds": (result) => result?.status === 101 });
}
