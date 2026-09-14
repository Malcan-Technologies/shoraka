import { renderReceiptHtmlToPdfBuffer } from "../../payment/receipt/render-receipt-html-to-pdf";

export function renderServicingLetterHtmlToPdf(html: string): Promise<Buffer> {
  return renderReceiptHtmlToPdfBuffer(html);
}
