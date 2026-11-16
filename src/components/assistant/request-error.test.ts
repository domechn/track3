import { describe, expect, it } from "vitest";
import { splitRequestError } from "./request-error";

describe("splitRequestError", () => {
  it("reads the stored fixture shape", () => {
    expect(splitRequestError("[error] HTTP 429, retry after 20 s")).toEqual({
      before: "", detail: "HTTP 429, retry after 20 s", httpStatus: "429",
    });
  });

  it("returns null for a plain answer", () => {
    expect(splitRequestError("Your portfolio is up 4% this week.")).toBeNull();
  });

  it("reads the live shape written by the chat hook", () => {
    expect(splitRequestError("\n\n[error] Request failed with status 429: slow down")).toEqual({
      before: "", detail: "Request failed with status 429: slow down", httpStatus: "429",
    });
  });

  it("keeps the partial answer that came before the failure", () => {
    expect(splitRequestError("BTC is up.\n\n\n\n[error] stream timed out")).toEqual({
      before: "BTC is up.", detail: "stream timed out", httpStatus: undefined,
    });
  });

  it("ignores a marker the model wrote in the middle of a line", () => {
    expect(splitRequestError("Logs that contain [error] lines are skipped.")).toBeNull();
  });
});
