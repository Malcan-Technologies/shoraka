-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "required_documents" JSONB NOT NULL,
    "declarations" JSONB,
    "max_financing_percent" DECIMAL(5,2) NOT NULL,
    "min_profit_rate" DECIMAL(5,2) NOT NULL,
    "max_profit_rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

