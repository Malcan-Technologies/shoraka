CREATE TABLE "book_metrics_daily_snapshots" (
    "id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "outstanding_amount" DECIMAL(18,6) NOT NULL,
    "outstanding_count" INTEGER NOT NULL,
    "in_funding_amount" DECIMAL(18,6) NOT NULL,
    "in_funding_count" INTEGER NOT NULL,
    "arrears_amount" DECIMAL(18,6) NOT NULL,
    "arrears_count" INTEGER NOT NULL,
    "defaulted_amount" DECIMAL(18,6) NOT NULL,
    "defaulted_count" INTEGER NOT NULL,
    "due_soon_amount" DECIMAL(18,6) NOT NULL,
    "due_soon_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_metrics_daily_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "book_metrics_daily_snapshots_snapshot_date_key" ON "book_metrics_daily_snapshots"("snapshot_date");
