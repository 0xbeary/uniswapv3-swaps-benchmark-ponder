# Uniswap V3 Swap Event Indexer

A high-performance blockchain indexer built with [Ponder](https://ponder.sh) that tracks Uniswap V3 swap events from the ETH/USDC pool on Ethereum mainnet. This indexer captures detailed swap data including amounts, prices, liquidity, and tick information for analysis and querying.

## What This Indexer Does

This project indexes swap events from the Uniswap V3 ETH/USDC pool contract (`0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`) starting from its deployment block. For each swap transaction, it captures:

- **Swap participants**: Sender and recipient addresses
- **Token amounts**: Amount of ETH and USDC exchanged
- **Price information**: Square root price (sqrtPriceX96)
- **Liquidity data**: Active liquidity at time of swap
- **Position data**: Current tick after the swap
- **Block metadata**: Block number, timestamp, and transaction hash

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **pnpm**
- **Docker** (for PostgreSQL)
- **Ethereum RPC URL** (Alchemy, Infura, or similar)

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd univ3-ponder
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Ethereum RPC URL (required)
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Database URL (required for stability)
DATABASE_URL=postgresql://postgres:password@localhost:5432/ponder_dev
```

### 3. Set Up PostgreSQL Database

**Docker PostgreSQL (Recommended)**
```bash
# Start PostgreSQL container
docker run --name ponder-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ponder_dev \
  -p 5432:5432 -d postgres:15

# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://postgres:password@localhost:5432/ponder_dev"
```

### 4. Start the Indexer

```bash
npm run dev
```

The indexer will:
- Connect to Ethereum mainnet
- Start syncing from block 12,376,729 (Uniswap V3 deployment)
- Begin indexing swap events
- Serve a GraphQL API at `http://localhost:42069`

## Project Structure

```
univ3-ponder/
├── src/
│   ├── api/
│   │   └── index.ts          # GraphQL API endpoints
│   └── index.ts              # Indexing functions
├── abis/
│   └── SwapContract.ts       # Uniswap V3 Pool ABI
├── ponder.config.ts          # Ponder configuration
├── ponder.schema.ts          # Database schema
├── package.json
└── README.md
```

## Configuration Files

### `ponder.config.ts`
Defines the blockchain networks, contracts to index, and starting blocks:

```typescript
export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: process.env.PONDER_RPC_URL_1,
    },
  },
  contracts: {
    SwapContract: {
      abi: SwapContractAbi,
      chain: "mainnet",
      address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640", // ETH/USDC pool
      startBlock: 12376729, // Pool deployment block
    },
  },
});
```

### `ponder.schema.ts`
Defines the database schema for storing swap data:

```typescript
export const swap = onchainTable("swap", (t) => ({
  id: t.hex().primaryKey(),           // Unique event identifier
  sender: t.hex().notNull(),          // Swap initiator
  recipient: t.hex().notNull(),       // Swap recipient
  amount0: t.bigint().notNull(),      // ETH amount (can be negative)
  amount1: t.bigint().notNull(),      // USDC amount (can be negative)
  sqrtPriceX96: t.bigint().notNull(), // Square root price
  liquidity: t.bigint().notNull(),    // Active liquidity
  tick: t.integer().notNull(),        // Current tick
  blockNumber: t.bigint().notNull(),  // Block number
  blockTimestamp: t.bigint().notNull(), // Block timestamp
  transactionHash: t.hex().notNull(), // Transaction hash
}));
```

## Querying Data

### GraphQL API

Once running, visit `http://localhost:42069/graphql` to explore the GraphQL playground.

**Example queries:**

```graphql
# Get recent swaps
query RecentSwaps {
  swaps(limit: 10, orderBy: "blockNumber", orderDirection: "desc") {
    items {
      id
      sender
      recipient
      amount0
      amount1
      sqrtPriceX96
      tick
      blockTimestamp
      transactionHash
    }
  }
}

# Get large swaps (> 1000 USDC)
query LargeSwaps {
  swaps(
    where: { amount1: { gt: "1000000000" } }  # USDC has 6 decimals
    orderBy: "amount1"
    orderDirection: "desc"
    limit: 20
  ) {
    items {
      amount0
      amount1
      sqrtPriceX96
      blockTimestamp
      transactionHash
    }
  }
}

# Get swaps in a specific block range
query SwapsByBlock {
  swaps(
    where: { 
      blockNumber: { gte: "18000000", lte: "18001000" }
    }
  ) {
    items {
      blockNumber
      amount0
      amount1
      tick
    }
  }
}
```

### Direct SQL Access

If using PostgreSQL, you can query directly:

```sql
-- Top 10 largest ETH swaps
SELECT 
  ABS(amount0) as eth_amount,
  ABS(amount1) as usdc_amount,
  transaction_hash,
  block_timestamp
FROM swap 
WHERE amount0 < 0  -- ETH being sold
ORDER BY ABS(amount0) DESC 
LIMIT 10;

-- Average daily trading volume
SELECT 
  DATE(to_timestamp(block_timestamp)) as date,
  SUM(ABS(amount1)) / 1000000 as daily_usdc_volume
FROM swap 
GROUP BY DATE(to_timestamp(block_timestamp))
ORDER BY date DESC;
```

## Development

### Running in Development Mode

```bash
# Start with hot reloading
npm run dev

# Start with verbose logging
PONDER_LOG_LEVEL=debug npm run dev

# Start with trace-level logging
PONDER_LOG_LEVEL=trace npm run dev
```

### Modifying the Schema

1. Update `ponder.schema.ts`
2. The indexer will automatically detect changes and migrate the database
3. Update your indexing functions in `src/index.ts` if needed

### Adding Custom API Endpoints

Add custom endpoints to `src/api/index.ts`:

```typescript
import { Hono } from "hono";
import { graphql } from "ponder";
import { db } from "ponder:api";
import schema from "ponder:schema";

const app = new Hono();

// Default GraphQL endpoints
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// Custom endpoint for swap statistics
app.get("/stats", async (c) => {
  const stats = await db
    .select({
      totalSwaps: sql`count(*)`,
      totalVolume: sql`sum(abs(amount1))`,
    })
    .from(schema.swap);
  
  return c.json(stats[0]);
});

export default app;
```

## Troubleshooting

### Common Issues

**1. Indexer stuck at 1 event or hanging**
- **Cause**: Database operations getting stuck (common with PGlite)
- **Solution**: Use PostgreSQL with Docker:
  ```bash
  # Stop current process
  Ctrl+C
  
  # Start PostgreSQL
  docker run --name ponder-postgres \
    -e POSTGRES_PASSWORD=password \
    -e POSTGRES_DB=ponder_dev \
    -p 5432:5432 -d postgres:15
  
  # Set environment and restart
  export DATABASE_URL="postgresql://postgres:password@localhost:5432/ponder_dev"
  npm run dev
  ```

**2. RPC rate limiting**
- **Symptoms**: Very slow sync or timeouts
- **Solution**: Use a paid RPC provider or increase rate limits

**3. "Column violates not-null constraint"**
- **Cause**: Event structure mismatch
- **Solution**: Check ABI and update schema accordingly

**4. Memory issues**
- **Symptoms**: Process killed or OOM errors
- **Solution**: Increase available memory or use block ranges

### Performance Optimization

**For faster testing (use smaller block ranges):**
```typescript
// In ponder.config.ts
startBlock: 22700000, // Recent block instead of 12376729
endBlock: 22750000,   // Limit range for testing
```

**For production (full historical data):**
```typescript
// In ponder.config.ts
startBlock: 12376729, // Original deployment block
// endBlock: undefined, // Sync to latest
```

### Debug Commands

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View logs with trace level
PONDER_LOG_LEVEL=trace npm run dev

# Test RPC connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $PONDER_RPC_URL_1

# Check database connection
psql $DATABASE_URL -c "SELECT version();"
```

## Monitoring

### Health Endpoints

- `/health` - Returns 200 when service is running
- `/ready` - Returns 200 when historical sync is complete
- `/status` - Returns detailed sync status

### Metrics

Check sync progress:
```bash
curl http://localhost:42069/status
```

## Deployment

### Production Deployment

1. **Environment Setup**
```bash
# Production environment variables
PONDER_RPC_URL_1=https://your-production-rpc-url
DATABASE_URL=postgresql://user:pass@prod-db:5432/ponder
NODE_ENV=production
```

2. **Database Migration**
```bash
# Ensure database exists and is accessible
npm run start
```

3. **Process Management**
```bash
# Using PM2
npm install -g pm2
pm2 start "npm run start" --name "uniswap-indexer"

# Using Docker
docker build -t uniswap-indexer .
docker run -d --name uniswap-indexer \
  -e PONDER_RPC_URL_1=$RPC_URL \
  -e DATABASE_URL=$DATABASE_URL \
  -p 42069:42069 \
  uniswap-indexer
```

### Railway Deployment

```bash
# Add start command with schema
pnpm start --schema $RAILWAY_DEPLOYMENT_ID
```

## Use Cases

This indexer is perfect for:

- **DeFi Analytics**: Track trading volumes, price impacts, and liquidity changes
- **MEV Research**: Analyze sandwich attacks and arbitrage opportunities  
- **Portfolio Tracking**: Monitor specific addresses' trading activity
- **Market Analysis**: Study price movements and trading patterns
- **Bot Development**: Real-time swap monitoring for trading strategies
- **Academic Research**: Historical DeFi market analysis

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Resources

- [Ponder Documentation](https://ponder.sh/docs)
- [Uniswap V3 Documentation](https://docs.uniswap.org/protocol/V3/introduction)
- [Ethereum JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/)
- [GraphQL Documentation](https://graphql.org/learn/)

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Always verify data independently for critical applications.