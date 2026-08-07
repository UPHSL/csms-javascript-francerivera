import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";

const app = createApp();

test("home page returns successfully", async () => {
  const response = await request(app).get("/");

  assert.equal(response.statusCode, 200);
});

test("home page displays the CSMS starter details", async () => {
  const response = await request(app).get("/");

  assert.match(
    response.text,
    /Community Services Management System/
  );

  assert.match(
    response.text,
    /Sprint 0 - Developer Onboarding/
  );

  assert.match(
    response.text,
    /JavaScript with Express\.js/
  );

  assert.match(response.text, /0\.1\.0/);
});

test("health endpoint returns the expected payload", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.statusCode, 200);

  assert.deepEqual(response.body, {
    status: "ok",
    application: "Community Services Management System",
    version: "0.1.0"
  });
});

test("unknown route returns HTTP 404", async () => {
  const response = await request(app).get("/does-not-exist");

  assert.equal(response.statusCode, 404);

  assert.deepEqual(response.body, {
    status: "error",
    message: "Resource not found"
  });
});