import test from "node:test";
import assert from "node:assert/strict";
import userRouter from "../routers/libs/user.routers.js";
import drinkRouter from "../routers/libs/drinks.routers.js";
import eventRouter from "../routers/libs/event.routers.js";
import bidRouter from "../routers/libs/bid.routers.js";
import { authEmployee } from "../middleware/libs/authEmployee.middleware.js";
import { UserModel } from "../models/index.js";

const routeLayers = (router, method, path) =>
  router.stack.filter(
    (layer) => layer.route?.path === path && layer.route?.methods?.[method]
  );

const middlewareNames = (method, path, router = userRouter) => {
  const layers = routeLayers(router, method, path);
  assert.equal(layers.length, 1, `Expected exactly one ${method.toUpperCase()} ${path} route`);
  return layers[0].route.stack.map((layer) => layer.name);
};

test("user directory routes require authentication and employee authorization", () => {
  for (const [method, path] of [
    ["get", "/"],
    ["get", "/regulars"],
    ["get", "/employees"],
    ["get", "/employees/not-reporting"],
    ["get", "/:id"],
  ]) {
    assert.deepEqual(middlewareNames(method, path).slice(0, 2), ["auth", "authEmployee"]);
  }
});

test("admin user mutation routes require authentication and employee authorization", () => {
  assert.deepEqual(middlewareNames("put", "/:id").slice(0, 2), ["auth", "authManager"]);
  assert.deepEqual(
    middlewareNames("delete", "/:id/delete").slice(0, 2),
    ["auth", "authManager"]
  );
});

test("authEmployee rejects regular and bartender accounts", async () => {
  for (const role of ["regular", "bartender", undefined]) {
    let status;
    let body;
    let calledNext = false;
    const res = {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        body = value;
        return this;
      },
    };

    await authEmployee({ user: { role } }, res, () => {
      calledNext = true;
    });

    assert.equal(calledNext, false);
    assert.equal(status, 403);
    assert.equal(body.success, false);
  }
});

test("authEmployee allows employee and admin accounts", async () => {
  for (const role of ["employee", "admin"]) {
    let calledNext = false;
    await authEmployee({ user: { role } }, {}, () => {
      calledNext = true;
    });
    assert.equal(calledNext, true);
  }
});

test("credential fields are excluded from user queries by default", () => {
  assert.equal(UserModel.schema.path("passwordHash").options.select, false);
  assert.equal(UserModel.schema.path("resetPasswordToken").options.select, false);
  assert.equal(UserModel.schema.path("resetPasswordExpires").options.select, false);
  assert.equal(UserModel.schema.path("activationTokenHash").options.select, false);
  assert.equal(
    UserModel.schema.path("activationTokenExpiresAt").options.select,
    false
  );
});

test("drink creation and media uploads require employee authorization", () => {
  for (const path of ["/create", "/upload-image", "/upload-video"]) {
    assert.deepEqual(
      middlewareNames("post", path, drinkRouter).slice(0, 2),
      ["auth", "authEmployee"]
    );
  }
});

test("event staffing mutations require employee authorization", () => {
  for (const path of ["/:id/assign-bartenders", "/:id/remove-bartenders"]) {
    assert.deepEqual(
      middlewareNames("post", path, eventRouter).slice(0, 2),
      ["auth", "authEmployee"]
    );
  }
});

test("bid management lists require employee authorization", () => {
  for (const path of [
    "/event/:eventId",
    "/event/:eventId/interested",
    "/user/:userId",
  ]) {
    assert.deepEqual(
      middlewareNames("get", path, bidRouter).slice(0, 2),
      ["auth", "authEmployee"]
    );
  }
});
