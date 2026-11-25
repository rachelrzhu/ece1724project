import { expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { serializableTransaction } from "@/lib/db/serializable";

vi.mock("server-only", () => ({}));

function adapterError(code: string) {
  return Object.assign(new Error("database transaction failed", { cause: { originalCode: code } }), { name: "DriverAdapterError" });
}

it("retries Prisma and commit-time PostgreSQL serialization aborts", async () => {
  const transaction = vi.fn()
    .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Write conflict", {
      code: "P2034", clientVersion: Prisma.prismaVersion.client,
    }))
    .mockRejectedValueOnce(adapterError("40001"))
    .mockResolvedValueOnce("reserved");
  const db = { $transaction: transaction } as unknown as PrismaClient;
  const work = vi.fn();
  expect(await serializableTransaction(db, work)).toBe("reserved");
  expect(transaction).toHaveBeenCalledTimes(3);
  expect(transaction).toHaveBeenCalledWith(work, { isolationLevel: "Serializable" });
});

it("caps retries under persistent contention", async () => {
  const error = adapterError("40001");
  const transaction = vi.fn().mockRejectedValue(error);
  await expect(serializableTransaction({ $transaction: transaction } as unknown as PrismaClient, vi.fn())).rejects.toBe(error);
  expect(transaction).toHaveBeenCalledTimes(4);
});

it.each([new Error("Commit acknowledgment lost"), adapterError("08006")])("preserves an ambiguous failure without replaying it", async error => {
  const transaction = vi.fn().mockRejectedValue(error);
  await expect(serializableTransaction({ $transaction: transaction } as unknown as PrismaClient, vi.fn())).rejects.toBe(error);
  expect(transaction).toHaveBeenCalledOnce();
});
