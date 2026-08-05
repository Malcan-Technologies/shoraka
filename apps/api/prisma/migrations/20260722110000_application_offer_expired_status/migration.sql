-- Application-level Offer Expired status (filterable admin queue).
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_EXPIRED';
