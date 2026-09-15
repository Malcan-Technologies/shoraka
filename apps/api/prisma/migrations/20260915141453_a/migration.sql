/*
  Warnings:

  - You are about to drop the column `legal_entity_label` on the `operator_document_execution_bindings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "operator_document_execution_bindings" DROP COLUMN "legal_entity_label";
