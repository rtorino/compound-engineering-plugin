import { describe, test, expect } from "bun:test";
import { retry } from "./retry";

describe("retry", () => {
  test("returns result when function succeeds on first attempt", async () => {
    const fn = () => "success";

    const result = await retry(fn, 3);

    expect(result).toBe("success");
  });

  test("retries and returns result when function fails then succeeds", async () => {
    let attempts = 0;
    const fn = () => {
      attempts++;
      if (attempts < 3) throw new Error("fail");
      return "success";
    };

    const result = await retry(fn, 3);

    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  test("throws immediately when maxAttempts is 1 and function fails", async () => {
    const fn = () => {
      throw new Error("single failure");
    };

    await expect(retry(fn, 1)).rejects.toThrow("single failure");
  });

  test("throws the last error when all attempts fail", async () => {
    let attempts = 0;
    const fn = () => {
      attempts++;
      throw new Error(`failure ${attempts}`);
    };

    const error = await retry(fn, 3).catch((e: Error) => e);
    expect(error.message).toBe("failure 3");
  });

  test("returns result when function completes within timeout", async () => {
    const fn = () => "fast result";

    const result = await retry(fn, 3, { timeoutMs: 1000 });

    expect(result).toBe("fast result");
  });

  test("throws timeout error when function exceeds timeout", async () => {
    const fn = () => new Promise((resolve) => setTimeout(() => resolve("slow"), 5000));

    await expect(retry(fn, 3, { timeoutMs: 10 })).rejects.toThrow("Retry timed out after 10ms");
  });

  test("timeout of 0 behaves as no timeout", async () => {
    const fn = () => new Promise((resolve) => setTimeout(() => resolve("eventually"), 50));

    const result = await retry(fn, 1, { timeoutMs: 0 });

    expect(result).toBe("eventually");
  });
});
