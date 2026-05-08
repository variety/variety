// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: © 2026 James Cropcho <numerate_penniless652@dralias.com>
'use strict';

// Mocha root hook: ping mongod before each test when MongoDB is reachable at
// suite start. Converts cascading "beforeEach timeout" failures — which arise
// when mongod crashes mid-run — into a single clear "MongoDB unreachable"
// error on the first test that runs after the crash.
//
// Behaviour when mongod is not present (local dev without a server):
// pingClient stays null and all per-test pings are skipped, so the hook does
// not break workflows that run only engine/unit tests locally.

const { MongoClient } = require('mongodb');

const mongodbPort = Number(process.env['MONGODB_PORT'] || 27017);
const pingUrl = `mongodb://localhost:${mongodbPort}/admin`;
const PING_TIMEOUT_MS = 2000;

/** @type {import('mongodb').MongoClient | null} */
let pingClient = null;

exports.mochaHooks = {
  async beforeAll() {
    try {
      const client = new MongoClient(pingUrl, {
        serverSelectionTimeoutMS: PING_TIMEOUT_MS,
        connectTimeoutMS: PING_TIMEOUT_MS,
      });
      await client.connect();
      pingClient = client;
    } catch {
      // MongoDB is not available in this environment; disable per-test pings.
      pingClient = null;
    }
  },

  async afterAll() {
    if (pingClient) {
      await pingClient.close().catch(() => {});
      pingClient = null;
    }
  },

  async beforeEach() {
    if (!pingClient) { return; }
    try {
      await pingClient.db('admin').command({ ping: 1 });
    } catch {
      throw new Error(
        `MongoDB is unreachable on port ${mongodbPort} — mongod may have crashed. ` +
        'Check the container log for "mongod exited with status" and SIGSEGV details.'
      );
    }
  },
};
