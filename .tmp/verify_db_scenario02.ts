import { PrismaClient } from '@prisma/client';
import { formatNumber } from '@cashsouk/config';
import { resolveCtosReturnOnEquityPercent } from '@cashsouk/types';

const prisma = new PrismaClient();

async function main() {
  const note = await prisma.note.findFirst({
    where: { note_reference: { endsWith: '-02' } },
    select: {
      id: true,
      note_reference: true,
      source_application_id: true,
      issuer_organization_id: true,
      title: true,
    },
  });
  if (!note) throw new Error('note -02 not found');

  const app = await prisma.application.findUnique({
    where: { id: note.source_application_id },
    select: { id: true, financial_statements: true },
  });
  if (!app) throw new Error('application missing');

  const issuer = await prisma.issuerOrganization.findUnique({
    where: { id: note.issuer_organization_id },
    select: { id: true, name: true, registration_number: true },
  });

  const ctos = await prisma.ctosReport.findFirst({
    where: { issuer_organization_id: note.issuer_organization_id },
    orderBy: { fetched_at: 'desc' },
    select: { id: true, financials_json: true },
  });
  if (!ctos) throw new Error('ctosReport missing');

  const fs = app.financial_statements as any;
  const unaud = fs?.unaudited_by_year ?? {};
  const admin = fs?.admin_input_by_year ?? {};

  console.log('IDENTITY');
  console.log({
    noteId: note.id,
    noteReference: note.note_reference,
    applicationId: app.id,
    issuerId: issuer?.id,
    issuerName: issuer?.name,
    registrationNumber: issuer?.registration_number,
    ctosReportId: ctos.id,
  });

  console.log('\nFY presence (stored):');
  for (const fy of [2023, 2024, 2025, 2026]) {
    const inCtos = (ctos.financials_json ?? []).some((r: any) => r?.financial_year === fy);
    const inUnaud = unaud[String(fy)] != null;
    const inAdmin = admin[String(fy)] != null;
    console.log(`FY${fy}`, { inCtos, inUnaud, inAdmin });
  }

  function getAcct(fy: number) {
    return (ctos.financials_json ?? []).find((r: any) => r?.financial_year === fy)?.account ?? null;
  }

  const required = ['return_on_equity', 'bsqres', 'bsqupro', 'bsqmint', 'plminin'] as const;
  for (const fy of [2023, 2024]) {
    const acct = getAcct(fy);
    console.log(`\nFY${fy} CTOS required fields:`);
    for (const k of required) {
      console.log(' ', k, '=>', (acct as any)?.[k]);
    }

    const roe = resolveCtosReturnOnEquityPercent({ return_on_equity: (acct as any)?.return_on_equity });
    console.log(' FY' + fy + ' ROE formatted:', roe != null ? formatNumber(roe, 2) + '%' : 'Not available');
  }

  console.log('\nFY2026 user input equity keys (raw):');
  console.log({
    equity_share_premium: unaud['2026']?.equity_share_premium,
    equity_accumulated_profit: unaud['2026']?.equity_accumulated_profit,
    equity_minority: unaud['2026']?.equity_minority,
    pl_minority: unaud['2026']?.pl_minority,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
