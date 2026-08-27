/**
 * Approved MARC / Strato appendix legal wording.
 * Isolated so MARC-approved copy can be replaced without redesigning the page.
 * Do not paraphrase in call sites.
 */

export const MARC_APPENDIX_METHODOLOGY_PARAGRAPHS = [
  "The methodology for determining credit scoring and probability of default involves the analysis of various financial and operational factors. This assessment combines quantitative metrics, such as financial ratios and cash flow analysis, with qualitative factors, including legal factors and management quality.",
  "To derive the credit scoring, the assessment evaluates the company's creditworthiness relative to industry benchmarks and historical data. The probability of default is calculated by assessing the likelihood of the company facing financial distress or defaulting on its obligations. This involves analysing factors such as debt levels, liquidity position, profitability, and overall business stability.",
  "The methodology emphasises thorough research, statistical modelling, and expert judgment to provide a comprehensive and accurate evaluation of the subject company's credit scoring and probability of default.",
] as const;

export const MARC_APPENDIX_FACTOR_ROWS = [
  {
    title: "Historical and Ownership Review (35%)",
    body: "This assessment takes account of various historical, ownership and legal factors relevant to the subject company.",
  },
  {
    title: "Leverage Assessment (28%)",
    body: "This assessment evaluates how effectively the subject company manages its financial structure.",
  },
  {
    title: "Profitability Assessment (15%)",
    body: "This assessment considers the financial performance and profitability of the subject company.",
  },
  {
    title: "Liquidity Assessment (12%)",
    body: "This assessment evaluates the efficiency of the subject company in managing its working capital and cash flow.",
  },
  {
    title: "Operational Efficiency (5%)",
    body: "This assessment reviews the subject company's ability to manage its operational assets efficiently.",
  },
  {
    title: "External Auditor (5%)",
    body: "This assessment evaluates the firm of external auditors engaged by the subject company.",
  },
] as const;

export const MARC_APPENDIX_FACTOR_FOOTNOTE =
  "*The % in the bracket represents the weightage applied in the calculation of the credit score.";

export const MARC_CUSTOMER_SERVICE_HTML_PARAGRAPHS = [
  "For further information or if you have any queries, please contact us at <strong>www.marcdata.com.my/contact</strong>.",
  "<strong>MARC Data Sdn Bhd</strong><br>19-07, Level 19, Q Sentral, 2A Jalan Stesen Sentral 2, Kuala Lumpur Sentral,<br>50470 Kuala Lumpur, Malaysia<br>Email: data@marc.com.my",
  "<strong>For all inquiries, please include the following details (required):</strong>",
] as const;

export const MARC_CUSTOMER_SERVICE_INQUIRY_ITEMS = [
  "Full company name",
  "Company registered number",
  "Contact number",
  "Enquiry number",
  "Order date",
] as const;

export const MARC_DISCLAIMER_PARAGRAPHS = [
  "Copyright © 2024 MARC Data Sdn Bhd (“MARC Data”) have exclusive proprietary rights in the data or information provided herein. This report is the property of MARC Data and is protected by Malaysian and international copyright laws and conventions. The data and information shall only be used for intended purposes and not for any improper or unauthorised purpose. All information contained herein shall not be copied or otherwise reproduced, repackaged, transmitted, transferred, disseminated, redistributed, or resold for any purpose, in whole or in part, in any form or manner, or by any means or person without MARC Data’s prior written consent.",
  "This report is strictly confidential and privileged and is intended solely for the information and benefit of the addressee or recipient. If you are not the intended recipient, and/or have received this report in error, please delete this report and do not copy, disseminate, distribute, or disclose the content of this report to any other person.",
  "The information which MARC Data relies on are publicly available and confidentially provided information obtained from third-party sources which MARC Data reasonably believes to be accurate and reliable to the greatest extent. MARC Data assumes no obligation to undertake independent verification of any information it receives and does not guarantee the accuracy, completeness, and timeliness of such information.",
] as const;

export const MARC_DISCLAIMER_UPPERCASE =
  "MARC DATA OR ITS AFFILIATES, DIRECTORS AND EMPLOYEES DISCLAIM ANY WARRANTY, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTY AS TO THE ACCURACY, COMPLETENESS OR TIMELINESS OF ANY INFORMATION CONTAINED HEREIN FOR ANY PARTICULAR PURPOSE AND SHALL NOT IN ANY EVENT BE HELD RESPONSIBLE FOR ANY DAMAGES, DIRECT OR INDIRECT, CONSEQUENTIAL OR COMPENSATORY, ARISING OUT OF THE USE OF SUCH INFORMATION.";

export const MARC_DISCLAIMER_CLOSING_PARAGRAPHS = [
  "MARC Data will not defend, indemnify, or hold harmless any user of this report against any claims, demands, damages, losses, proceedings, costs and/or expenses which the user may suffer or incur as a result of relying on this report in any way whatsoever. Any person making use of and/or relying on any credit reporting produced by MARC Data and information contained therein solely assumes the risk in making use of and/or relying on such reports and all information contained therein and acknowledges that this disclaimer has been read and understood and agrees to be bound by it.",
  "A credit report which generates financial and other available data is not a recommendation to buy, sell or hold any security and/or investment nor is it a directive on extending credit or making lending decisions. The information provided is intended solely for the purpose of assessing creditworthiness and should not be construed as financial advice.",
  "Any user of this report should not rely solely on the credit and financial analysis contained in this report to make an investment or credit decision in as much as it does not address non-credit risks, the adequacy of market price, suitability of any security for a particular investor, or the tax-exempt nature or taxability of payments made in respect to any security concerned.",
  "Data generated from the credit report may be changed or withdrawn at any time for any reason at the sole discretion of MARC Data. MARC Data may make modifications to and/or amendments in credit reports including information contained therein at any time after publication as it deems appropriate. This report is not intended to be the sole basis for evaluating creditworthiness or making investment decisions, and users are advised to consider additional factors and seek professional advice when making investment and credit decisions.",
] as const;
