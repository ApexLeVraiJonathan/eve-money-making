-- Drop retired Strategy Lab persistence. This intentionally removes all
-- historical Strategy Lab strategies, runs, daily snapshots, and positions.
-- IF EXISTS supports dev DBs that never had Strategy Lab tables applied.
DROP TABLE IF EXISTS "trade_strategy_run_positions";
DROP TABLE IF EXISTS "trade_strategy_run_days";
DROP TABLE IF EXISTS "trade_strategy_runs";
DROP TABLE IF EXISTS "trade_strategies";

DROP TYPE IF EXISTS "TradeStrategyPriceModel";
DROP TYPE IF EXISTS "TradeStrategySellModel";
DROP TYPE IF EXISTS "TradeStrategyRunStatus";
