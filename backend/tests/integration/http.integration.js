import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import mongoose from "mongoose";
import request from "supertest";

const mongoUri = process.env.TEST_MONGO_URI;
if (!mongoUri || !new URL(mongoUri).pathname.includes("tipsyverse_integration")) {
  throw new Error(
    "TEST_MONGO_URI must target an explicitly named tipsyverse_integration database."
  );
}

process.env.NODE_ENV = "test";
process.env.API_URL = "/api/v1";
process.env.ACCESS_TOKEN_SECRET = "integration-access-secret-at-least-32-characters";
process.env.REFRESH_TOKEN_SECRET =
  "integration-refresh-secret-at-least-32-characters";

const { app } = await import("../../server.js");

before(async () => {
  await mongoose.connect(mongoUri);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("readiness reflects a real MongoDB connection", async () => {
  const response = await request(app).get("/api/v1/ready").expect(200);
  assert.deepEqual(response.body, { success: true, status: "ready" });
});

test("login validates malformed input before querying", async () => {
  const response = await request(app)
    .post("/api/v1/users/login")
    .send({ password: "example-password" })
    .expect(400);

  assert.equal(response.body.code, "VALIDATION_ERROR");
  assert.equal(
    response.body.issues.some(({ field }) => field === "emailOrUsername"),
    true
  );
});

test("login queries MongoDB and returns a generic credential failure", async () => {
  const response = await request(app)
    .post("/api/v1/users/login")
    .send({
      emailOrUsername: "missing@example.com",
      password: "example-password",
    })
    .expect(400);

  assert.equal(response.body.message, "Invalid credentials.");
});
