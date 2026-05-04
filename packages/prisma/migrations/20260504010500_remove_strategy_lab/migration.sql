-- Drop retired Strategy Lab persistence. This intentionally removes all
-- historical Strategy Lab strategies, runs, daily snapshots, and positions.
DROP TABLE "trade_strategy_run_positions";
DROP TABLE "trade_strategy_run_days";
DROP TABLE "trade_strategy_runs";
DROP TABLE "trade_strategies";

DROP TYPE "TradeStrategyPriceModel";
DROP TYPE "TradeStrategySellModel";
DROP TYPE "TradeStrategyRunStatus";
