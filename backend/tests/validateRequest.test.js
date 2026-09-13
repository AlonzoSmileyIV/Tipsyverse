import assert from "node:assert/strict";
import test from "node:test";
import { validateWriteBody } from "../middleware/libs/validateRequest.middleware.js";

const runValidation = (body) => {
  const req = {
    method: "PUT",
    body,
    is: () => false,
  };
  let response;
  let calledNext = false;
  const res = {
    status(status) {
      response = { status };
      return this;
    },
    json(payload) {
      response.payload = payload;
      return this;
    },
  };

  validateWriteBody(req, res, () => {
    calledNext = true;
  });

  return { req, response, calledNext };
};

test("write validation permits a bodyless mutation as an empty object", () => {
  const result = runValidation(undefined);

  assert.equal(result.calledNext, true);
  assert.deepEqual(result.req.body, {});
  assert.equal(result.response, undefined);
});

test("write validation still rejects an explicit non-object JSON body", () => {
  const result = runValidation(null);

  assert.equal(result.calledNext, false);
  assert.equal(result.response.status, 400);
  assert.equal(result.response.payload.code, "VALIDATION_ERROR");
});
