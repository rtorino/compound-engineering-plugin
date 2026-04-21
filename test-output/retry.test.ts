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

    expect(retry(fn, 1)).rejects.toThrow("single failure");
  });

  test("throws the last error when all attempts fail", async () => {
    let attempts = 0;
    const fn = () => {
      attempts++;
      throw new Error(`failure ${attempts}`);
    };

    expect(retry(fn, 3)).rejects.toThrow("failure 3");
    expect(retry(fn, 3)).rejects.not.toThrow("failure 1");
  });
});
