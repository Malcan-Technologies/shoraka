"use client";

import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import {
  formatNoteReferenceDisplay,
  INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
  type InvestmentSettlementConfirmationPdfPayload,
} from "@cashsouk/types";
import { PORTFOLIO_TRANSACTIONS_HREF } from "@/portfolio/portfolio-tabs";
import styles from "./investment-settlement-confirmation.module.css";

type Props = {
  confirmation: InvestmentSettlementConfirmationPdfPayload;
  onDownload: () => void;
  downloadPending?: boolean;
};

export function InvestmentSettlementConfirmationCard({
  confirmation,
  onDownload,
  downloadPending = false,
}: Props) {
  const noteId =
    formatNoteReferenceDisplay(confirmation.noteReference) || confirmation.noteReference;

  return (
    <section
      className={styles.card}
      aria-labelledby="investment-settlement-confirmation-title"
      data-investment-settlement-confirmation
    >
      <div className={styles.successIcon} aria-hidden="true">
        <svg viewBox="0 0 100 100" role="img">
          <circle cx="50" cy="50" r="47"></circle>
          <path d="M29 51.5 43.5 66 72 36"></path>
        </svg>
      </div>
      <h2 id="investment-settlement-confirmation-title" className={styles.title}>
        Investment Settlement Confirmation
      </h2>
      <div className={styles.statusPill}>
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 2.5l3.1 3.1 4.3-.2 1.5 4 3.8 2.1-.7 4.3 2.4 3.6-2.4 3.6.7 4.3-3.8 2.1-1.5 4-4.3-.2L16 36.5l-3.1-3.1-4.3.2-1.5-4-3.8-2.1.7-4.3-2.4-3.6L4 16l-.7-4.3 3.8-2.1 1.5-4 4.3.2L16 2.5z" transform="scale(.84) translate(3 0)"></path>
          <path className={styles.tick} d="m11.2 16.1 3.3 3.4 6.5-7"></path>
        </svg>
        <span>{confirmation.statusLabel}</span>
      </div>
      <p className={styles.intro}>{confirmation.introCopy}</p>
      <div className={styles.divider} />
      <dl className={styles.details}>
        <div className={styles.row}>
          <dt>Note ID</dt>
          <dd>{noteId}</dd>
        </div>
        <div className={styles.row}>
          <dt>Issuer ID</dt>
          <dd>{confirmation.issuerReference}</dd>
        </div>
        <div className={styles.row}>
          <dt>Settlement date</dt>
          <dd>{confirmation.settlementDateDisplay}</dd>
        </div>
      </dl>
      <div className={`${styles.divider} ${styles.dividerCompact}`} />
      <dl className={`${styles.details} ${styles.financials}`}>
        <div className={styles.row}>
          <dt>Principal returned</dt>
          <dd>{formatCurrency(confirmation.principalReturned)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Gross profit earned</dt>
          <dd>{formatCurrency(confirmation.grossProfitEarned)}</dd>
        </div>
        <div className={styles.row}>
          <dt>{confirmation.serviceFeeLabel}</dt>
          <dd className={styles.negative}>({formatCurrency(confirmation.serviceFeeAmount)})</dd>
        </div>
      </dl>
      <div className={`${styles.divider} ${styles.dividerFinancial}`} />
      <div className={`${styles.row} ${styles.netRow}`}>
        <span>Net profit credited</span>
        <strong>{formatCurrency(confirmation.netProfitCredited)}</strong>
      </div>
      {confirmation.showTawidh ? (
        <div className={styles.row}>
          <span>Ta’widh compensation</span>
          <strong>{formatCurrency(confirmation.tawidhCompensation)}</strong>
        </div>
      ) : null}
      <div className={styles.totalBox}>
        <span>Total credited to wallet</span>
        <strong>{formatCurrency(confirmation.totalCreditedToWallet)}</strong>
      </div>
      <aside className={styles.notice}>
        <div className={styles.noticeIcon} aria-hidden="true">
          i
        </div>
        <p>
          <strong>Processing notice:</strong>{" "}
          {confirmation.processingNotice || INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE}
        </p>
      </aside>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={onDownload}
          disabled={downloadPending || confirmation.status !== "READY"}
          aria-label="Download confirmation"
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 4v17"></path>
            <path d="m9.5 15.5 6.5 6.5 6.5-6.5"></path>
            <path d="M6 24.5v3h20v-3"></path>
          </svg>
          <span>Download confirmation</span>
        </button>
        <Link
          href={PORTFOLIO_TRANSACTIONS_HREF}
          className={`${styles.button} ${styles.secondary}`}
          aria-label="View wallet"
        >
          <svg viewBox="0 0 36 32" aria-hidden="true">
            <path d="M5.5 8.5h21a3 3 0 0 1 3 3v14H7.5a4 4 0 0 1-4-4v-17h20"></path>
            <path d="M7.5 8.5V6a3 3 0 0 1 3-3h14"></path>
            <path d="M27.5 14.5h5v7h-5a3.5 3.5 0 0 1 0-7z"></path>
            <circle cx="28" cy="18" r="1"></circle>
          </svg>
          <span>View wallet</span>
        </Link>
      </div>
    </section>
  );
}
