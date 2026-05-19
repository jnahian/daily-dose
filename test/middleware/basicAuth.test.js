describe("createBasicAuth", () => {
  const ORIG_ENV = { ...process.env };
  let createBasicAuth;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG_ENV };
    process.env.SCRIPTS_AUTH_USERNAME = "alice";
    process.env.SCRIPTS_AUTH_PASSWORD = "wonderland";
    ({ createBasicAuth } = require("../../src/middleware/basicAuth"));
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  function makeRes() {
    return {
      statusCode: undefined,
      headers: {},
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(obj) {
        this.body = obj;
        return this;
      },
      setHeader(k, v) {
        this.headers[k] = v;
      },
    };
  }

  function basicAuthHeader(user, pass) {
    return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }

  it("throws at construction if env vars are missing", () => {
    delete process.env.SCRIPTS_AUTH_USERNAME;
    jest.resetModules();
    const { createBasicAuth: factory } = require("../../src/middleware/basicAuth");
    expect(() => factory()).toThrow(/SCRIPTS_AUTH_USERNAME/);
  });

  it("returns 401 when no Authorization header is present", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    mw({ headers: {} }, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.headers["WWW-Authenticate"]).toMatch(/Basic realm=/);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization is not Basic", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    mw({ headers: { authorization: "Bearer abc" } }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 with bad credentials", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    mw(
      { headers: { authorization: basicAuthHeader("alice", "wrong") } },
      res,
      next
    );
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 with malformed base64 (no colon)", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    const malformed =
      "Basic " + Buffer.from("nocolon").toString("base64");
    mw({ headers: { authorization: malformed } }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() with valid credentials", () => {
    const mw = createBasicAuth();
    const res = makeRes();
    const next = jest.fn();
    mw(
      { headers: { authorization: basicAuthHeader("alice", "wonderland") } },
      res,
      next
    );
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it("handles passwords containing colons", () => {
    process.env.SCRIPTS_AUTH_PASSWORD = "wonder:land:1";
    jest.resetModules();
    const { createBasicAuth: factory } = require("../../src/middleware/basicAuth");
    const mw = factory();
    const res = makeRes();
    const next = jest.fn();
    mw(
      { headers: { authorization: basicAuthHeader("alice", "wonder:land:1") } },
      res,
      next
    );
    expect(next).toHaveBeenCalled();
  });
});
