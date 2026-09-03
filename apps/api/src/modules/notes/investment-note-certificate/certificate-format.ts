export function formatCertificateRm(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCertificateAmount(amount: number): string {
  return amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCertificateShare(percent: number): string {
  return `${percent.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatCertificateProfitRate(percent: number): string {
  return `${percent.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}% p.a.`;
}
