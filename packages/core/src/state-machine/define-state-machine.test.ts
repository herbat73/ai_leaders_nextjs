import { describe, expect, it } from "vitest";

import { ConflictError } from "../errors";
import { defineStateMachine } from "./define-state-machine";

type Light = "red" | "green" | "yellow" | "off";

const machine = defineStateMachine<Light>({
  transitions: { red: ["green"], green: ["yellow"], yellow: ["red", "off"] },
});

describe("defineStateMachine", () => {
  it("allows every declared move", () => {
    expect(machine.can("red", "green")).toBe(true);
    expect(machine.can("green", "yellow")).toBe(true);
    expect(machine.can("yellow", "red")).toBe(true);
    expect(machine.can("yellow", "off")).toBe(true);
  });

  it("forbids moves that are not declared, including staying put and going backwards", () => {
    expect(machine.can("red", "yellow")).toBe(false);
    expect(machine.can("green", "red")).toBe(false);
    expect(machine.can("red", "red")).toBe(false);
  });

  it("lists the reachable statuses and none for a terminal or unknown status", () => {
    expect(machine.allowed("yellow")).toEqual(["red", "off"]);
    expect(machine.allowed("off")).toEqual([]);
    expect(machine.allowed("not-a-status")).toEqual([]);
  });

  it("throws a 409 ConflictError naming the stored status when asserting a forbidden move", () => {
    const error = (() => {
      try {
        machine.assert("red", "off");
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ status: 409, code: "conflict", fieldErrors: { status: "red" } });
  });

  it("does not throw when asserting an allowed move, and next returns the target", () => {
    expect(() => machine.assert("red", "green")).not.toThrow();
    expect(machine.next("red", "green")).toBe("green");
    expect(() => machine.next("red", "off")).toThrow(ConflictError);
  });

  it("treats an unknown starting status as having no moves", () => {
    expect(machine.can("broken", "green")).toBe(false);
    expect(() => machine.assert("broken", "green")).toThrow(ConflictError);
  });
});
