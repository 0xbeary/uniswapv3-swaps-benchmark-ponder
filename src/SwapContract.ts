// src/index.ts
import { ponder } from "ponder:registry";
import { swap } from "ponder:schema";

ponder.on("SwapContract:Swap", async ({ event, context }) => {
  await context.db.insert(swap).values({
    id: event.id, // Use event.id - globally unique identifier
    sender: event.args.sender,
    recipient: event.args.recipient,
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    sqrtPriceX96: event.args.sqrtPriceX96,
    liquidity: event.args.liquidity,
    tick: event.args.tick,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash, // Use event.transaction.hash instead of event.log.transactionHash
    createdAt: new Date(),
  });
});