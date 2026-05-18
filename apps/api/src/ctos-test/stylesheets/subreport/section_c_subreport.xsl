<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/response"
                exclude-result-prefixes="xsl r">

    <xsl:template name="section_c1_template">

        <xsl:variable name="seq">
            <xsl:value-of select="@seq"/>
        </xsl:variable>

        <p class="title">
            C1: BANKING PAYMENT RECORDS (SOURCE: CCRIS, BANK NEGARA MALAYSIA)
        </p>

        <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:enq_code[@code != '2']">
            <xsl:choose>
                <xsl:when
                        test="//r:summary/r:enq_sum[@seq = $seq]/r:include_ccris = '1' and r:section_ccris and r:section_ccris[@data = 'true']">
                    <xsl:apply-templates select="r:section_ccris" mode="sectionC1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:include_ccris = '0'">
                        <p class="info">Not Selected</p>
                    </xsl:if>
                    <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:include_ccris = '1' and (not(r:section_ccris) or r:section_ccris[@data = 'false'])">
                        <p class="info">A check with Bank Negara Malaysia returned no result on Subject</p>
                    </xsl:if>
                    <br/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:if>
        <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:enq_code[@code = '2']">
            <p class="info">Not available in LitE Report - please obtain consent from subject and use the CTOS Report
                for credit related information
            </p>
            <br/>
        </xsl:if>
    </xsl:template>

    <xsl:template name="section_c2_template">
        <xsl:if test="r:section_ccris_supp">
            <xsl:variable name="seq">
                <xsl:value-of select="@seq"/>
            </xsl:variable>

            <p class="title">
                C2: CCRIS SUPPLEMENTARY INFORMATION
            </p>
            <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:enq_code[@code != '2']">
                <xsl:choose>
                    <xsl:when
                            test="//r:summary/r:enq_sum[@seq = $seq]/r:include_ccris_supp = '1' and r:section_ccris_supp and r:section_ccris_supp[@data = 'true'] and (r:section_ccris_supp/r:addresses/r:address or r:section_ccris_supp/r:contacts/r:contact or r:section_ccris_supp/r:occupations/r:occupation)">
                        <xsl:apply-templates select="r:section_ccris_supp"/>
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:include_ccris_supp = '0' or not(//r:summary/r:enq_sum[@seq = $seq]/r:include_ccris_supp)">
                            <p class="info">Not Selected</p>
                        </xsl:if>
                        <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:include_ccris_supp = '1' and ((not(r:section_ccris_supp) or r:section_ccris_supp[@data = 'false']) or not(r:section_ccris_supp/r:addresses/r:address or r:section_ccris_supp/r:contacts/r:contact or r:section_ccris_supp/r:occupations/r:occupation))">
                            <p class="info">No Information Available</p>
                        </xsl:if>
                        <br/>
                    </xsl:otherwise>
                </xsl:choose>
            </xsl:if>
            <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:enq_code[@code = '2']">
                <p class="info">Not available in LitE Report - please obtain consent from subject and use the CTOS
                    Report for credit related information
                </p>
                <br/>
            </xsl:if>
        </xsl:if>
    </xsl:template>

    <xsl:template name="section_c3_template_angkasa">
        <xsl:if test="r:section_angkasa">
            <xsl:variable name="seq">
                <xsl:value-of select="@seq"/>
            </xsl:variable>

            <p class="title">
                C3: SISTEM POTONGAN GAJI ANGKASA (SPGA) INFORMATION
            </p>
            <xsl:choose>
                <xsl:when
                        test="//r:summary/r:enq_sum[@seq = $seq]/r:include_angkasa = '1' and r:section_angkasa and r:section_angkasa[@data = 'true']">
                    <xsl:call-template name="r:section_c3_subreport_angkasa_information"/>
                    <xsl:call-template name="r:section_c3_subreport_angkasa_monthly_deduction"/>
                    <xsl:if test="r:section_angkasa/r:pending_deduction/r:details">
                        <xsl:call-template name="r:section_c3_subreport_angkasa_pending_deduction"/>
                    </xsl:if>
                    <xsl:call-template name="r:section_c3_subreport_angkasa_payment_history"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:include_angkasa = '0'">
                        <p class="info">Not Selected</p>
                    </xsl:if>
                    <xsl:if test="//r:summary/r:enq_sum[@seq = $seq]/r:include_angkasa = '1' and (not(r:section_angkasa) or r:section_angkasa[@data = 'false'])">
                        <p class="info">No Information Available</p>
                    </xsl:if>
                    <br/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:if>
    </xsl:template>

    <xsl:template match="r:section_ccris" mode="sectionC1">

        <xsl:apply-templates select="." mode="ccrisSumm"/>
        <br/>

        <xsl:apply-templates select="." mode="ccrisDetail"/>
        <br/>

        <xsl:apply-templates select="." mode="ccrisDerivatives"/>
        <br/>

    </xsl:template>

    <xsl:template match="r:section_ccris" mode="ccrisSumm">
        <xsl:variable name="totalOutstanding">
            <xsl:variable name="totalVal">
                <xsl:call-template name="sumNodes">
                    <xsl:with-param name="nodes"
                                    select="r:summary/r:liabilities/r:borrower | r:summary/r:liabilities/r:guarantor"/>
                </xsl:call-template>
            </xsl:variable>
            <xsl:choose>
                <xsl:when test="$totalVal != 0">
                    <xsl:call-template name="check_empty_number">
                        <xsl:with-param name="number" select="$totalVal"/>
                    </xsl:call-template>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="'-'"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="totalLimit">
            <xsl:call-template name="addNumbersNoZero">
                <xsl:with-param name="num1" select="r:summary/r:liabilities/r:borrower/@total_limit"/>
                <xsl:with-param name="num2" select="r:summary/r:liabilities/r:guarantor/@total_limit"/>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="totalFec">
            <xsl:call-template name="addNumbersNoZero">
                <xsl:with-param name="num1" select="r:summary/r:liabilities/r:borrower/@fec_limit"/>
                <xsl:with-param name="num2" select="r:summary/r:liabilities/r:guarantor/@fec_limit"/>
            </xsl:call-template>
        </xsl:variable>

        <table class="table">
            <tr>
                <th width="40%">CCRIS Entity Key</th>
                <td colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:summary/@entity_key"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th width="40%">Subject Status</th>
                <td colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:summary/@entity_warning"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <td class="title" colspan="4">CCRIS SUMMARY</td>
            </tr>
            <tr>
                <td class="header">Credit Applications</td>
                <td class="header text-center">No. of Applications</td>
                <td class="header text-center">Amount Applied</td>
                <td class="header"></td>
            </tr>
            <tr>
                <th>Approved in past 12 months</th>
                <td class="text-center">
                    <xsl:value-of select="r:summary/r:application/r:approved/@count"/>
                </td>
                <td class="text-center">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:summary/r:application/r:approved"/>
                    </xsl:call-template>
                </td>
                <td></td>
            </tr>
            <tr>
                <th>Pending</th>
                <td class="text-center">
                    <xsl:value-of select="r:summary/r:application/r:pending/@count"/>
                </td>
                <td class="text-center">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:summary/r:application/r:pending"/>
                    </xsl:call-template>
                </td>
                <td></td>
            </tr>
            <tr>
                <td class="header">Summary of Potential &amp; Current Liabilities</td>
                <td class="header text-center">Outstanding</td>
                <td class="header text-center">Total Limit</td>
                <td class="header text-center">FEC Limit</td>
            </tr>
            <tr>
                <th>As Borrower</th>
                <td class="text-center">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:summary/r:liabilities/r:borrower"/>
                    </xsl:call-template>
                </td>
                <td class="text-center">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:summary/r:liabilities/r:borrower/@total_limit"/>
                    </xsl:call-template>
                </td>
                <td class="text-center">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:summary/r:liabilities/r:borrower/@fec_limit"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th>As Guarantor</th>
                <td class="text-center">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:summary/r:liabilities/r:guarantor"/>
                    </xsl:call-template>
                </td>
                <td class="text-center">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:summary/r:liabilities/r:guarantor/@total_limit"/>
                    </xsl:call-template>
                </td>
                <td class="text-center">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:summary/r:liabilities/r:guarantor/@fec_limit"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th>Total</th>
                <td class="text-center">
                    <xsl:value-of select="$totalOutstanding"/>
                </td>
                <td class="text-center">
                    <xsl:value-of select="$totalLimit"/>
                </td>
                <td class="text-center">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="$totalFec"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th>Legal Action Taken</th>
                <td class="text-center">
                    <xsl:call-template name="check_boolean">
                        <xsl:with-param name="input" select="r:summary/r:legal/@status"/>
                    </xsl:call-template>
                </td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <th>Special Attention Account</th>
                <td class="text-center">
                    <xsl:call-template name="check_boolean">
                        <xsl:with-param name="input" select="r:summary/r:special_attention/@status"/>
                    </xsl:call-template>
                </td>
                <td></td>
                <td></td>
            </tr>
        </table>
    </xsl:template>

    <xsl:template match="r:section_ccris" mode="ccrisDerivatives">
        <table class="table-no-background">
            <tr>
                <td class="title" colspan="3">CCRIS DERIVATIVES</td>
            </tr>

            <xsl:if test="//r:summary/r:enq_sum/r:include_ie = '1'">
                <tr>
                    <th class="header" width="25%">Affordability Insight</th>
                    <th class="caption" width="35%">(RM)</th>
                    <td width="45%">
                        <xsl:choose>
                            <xsl:when test="(//r:summary/r:enq_sum/r:income_estimator/r:Lower_Band != '' and //r:summary/r:enq_sum/r:income_estimator/r:Lower_Band != '0')
            			and (//r:summary/r:enq_sum/r:income_estimator/r:Upper_Band != '' and //r:summary/r:enq_sum/r:income_estimator/r:Upper_Band != '0')">
                                <xsl:value-of
                                        select="format-number(//r:summary/r:enq_sum/r:income_estimator/r:Lower_Band, '#,##0')"/>
                                -
                                <xsl:value-of
                                        select="format-number(//r:summary/r:enq_sum/r:income_estimator/r:Upper_Band, '#,##0')"/>
                            </xsl:when>
                            <xsl:when
                                    test="(//r:summary/r:enq_sum/r:income_estimator/r:Lower_Band != '' and //r:summary/r:enq_sum/r:income_estimator/r:Lower_Band != '0')">
                                <xsl:value-of
                                        select="format-number(//r:summary/r:enq_sum/r:income_estimator/r:Lower_Band, '#,##0')"/>
                            </xsl:when>
                            <xsl:otherwise>
                                No Information Available
                            </xsl:otherwise>
                        </xsl:choose>
                    </td>
                </tr>
            </xsl:if>
            <tr>
                <th class="header" width="25%" rowspan="2">Earliest known facility</th>
                <th class="caption" width="35%">Date of application</th>
                <td width="45%">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:derivatives/r:application/r:date"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Facility type</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:application/r:facility/@code"/> -
                    <xsl:value-of select="r:derivatives/r:application/r:facility"/>
                </td>
            </tr>
            <tr>
                <th class="header" rowspan="4">Secured facilities</th>
                <th class="caption"># of facilities</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:facilities/r:secure/@total"/>
                </td>
            </tr>
            <tr>
                <th class="caption">Total outstanding balance (RM)</th>
                <td>
                    <xsl:call-template name="check_empty_number">
                        <xsl:with-param name="number" select="r:derivatives/r:facilities/r:secure/r:outstanding"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Total outstanding as % of total limit</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:facilities/r:secure/r:outstanding/@limit"/>%
                </td>
            </tr>
            <tr>
                <th class="caption">Average number of installments in arrears</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:facilities/r:secure/r:outstanding/@average"/>
                </td>
            </tr>
            <tr>
                <th class="header" rowspan="4">Unsecured facilities</th>
                <th class="caption"># of facilities</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:facilities/r:unsecure/@total"/>
                </td>
            </tr>
            <tr>
                <th class="caption">Total outstanding balance (RM)</th>
                <td>
                    <xsl:call-template name="check_empty_number">
                        <xsl:with-param name="number" select="r:derivatives/r:facilities/r:unsecure/r:outstanding"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Total outstanding as % of total limit</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:facilities/r:unsecure/r:outstanding/@limit"/>%
                </td>
            </tr>
            <tr>
                <th class="caption">Average number of installments in arrears</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:facilities/r:unsecure/r:outstanding/@average"/>
                </td>
            </tr>
            <tr>
                <th class="header">Credit Card</th>
                <th class="caption">Average Utilisation Last 6 Months</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:credit_card/@avg_usage_6_mths"/>%
                </td>
            </tr>
            <tr>
                <th class="header">Other Revolving Credits</th>
                <th class="caption">Average Utilisation Last 6 Months</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:oth_revolving_credits/@avg_usage_6_mths"/>%
                </td>
            </tr>
            <tr>
                <th class="header" rowspan="2">Charge Card</th>
                <th class="caption">Min Utilisation Last 12 Months (RM)</th>
                <td>RM
                    <xsl:call-template name="check_empty_number">
                        <xsl:with-param name="number" select="r:derivatives/r:charge_card/@min_usage_12_months"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Max Utilisation Last 12 Months (RM)</th>
                <td>RM
                    <xsl:call-template name="check_empty_number">
                        <xsl:with-param name="number" select="r:derivatives/r:charge_card/@max_usage_12_months"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="header">PTPTN</th>
                <th class="caption">Number of Accounts</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:ptptn/@total"/>
                </td>
            </tr>
            <tr>
                <th class="header">Local Lenders</th>
                <th class="caption">Number of Accounts</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:local_lenders/@total"/>
                </td>
            </tr>
            <tr>
                <th class="header">Foreign Lenders</th>
                <th class="caption">Number of Accounts</th>
                <td>
                    <xsl:value-of select="r:derivatives/r:foreign_lenders/@total"/>
                </td>
            </tr>
        </table>
    </xsl:template>

    <xsl:template match="r:section_ccris" mode="ccrisDetail">

        <xsl:variable name="currYear">
            <xsl:call-template name="getYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
            </xsl:call-template>
        </xsl:variable>

        <table class="table-ccris">
            <tr>
                <td class="title" colspan="25">CCRIS DETAILS</td>
            </tr>
            <tr>
                <td class="header" colspan="25">Loan Information</td>
            </tr>
            <tr>
                <th width="2%">No.</th>
                <th width="8%">Date</th>
                <th width="2%">Sts</th>
                <th width="6%">Capacity</th>
                <th width="5%">Lender Type</th>
                <th width="8%">Facility</th>
                <th width="8%">Total Outstanding Balance (RM)</th>
                <th width="8%">Date Balance Updated</th>
                <th width="8%">Limit / Installment Amount (RM)</th>
                <th width="5%">Prin. Repmt. Term</th>
                <th width="4%">Col Type</th>
                <th width="24%" colspan="12">Conduct Of Account For Last 12 Months</th>
                <th width="5%">LGL STS</th>
                <th width="7%">Date Status Updated</th>
            </tr>
            <tr>
                <th colspan="11"></th>
                <th width="12%" colspan="6" style="text-align: left; padding-left: 1%; border-right-width: 0;">
                    <xsl:copy-of select="$currYear"/>
                </th>
                <th width="12%" colspan="6" style="text-align: right; padding-right: 1%; border-left-width: 0;">
                    <xsl:copy-of select="$currYear - 1"/>
                </th>
                <th></th>
                <th></th>
            </tr>
            <tr>
                <th colspan="11">Outstanding Credit</th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">0</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">1</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">2</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">3</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">4</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">5</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">6</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">7</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">8</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">9</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">10</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">11</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th></th>
                <th></th>
            </tr>

            <xsl:apply-templates mode="loanDetails" select="r:accounts"/>

            <tr>
                <td class="header" colspan="25">Special Attention Account</td>
            </tr>
            <xsl:apply-templates mode="specialDetails" select="r:special_attention_accs"/>
            <tr>
                <td class="header" colspan="25">Credit Application</td>
            </tr>
            <xsl:apply-templates mode="apps" select="r:applications"/>
        </table>
        <br/>
        <xsl:apply-templates mode="remarkLegend" select="."/>
    </xsl:template>

    <xsl:template match="r:applications" mode="apps">

        <xsl:if test="r:application">
            <xsl:for-each select="r:application">
                <tr>
                    <td>
                        <xsl:value-of select="position()"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:date"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:status/@code"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:capacity/@code"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:lender_type/@code"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:facility/@code"/>
                    </td>
                    <td></td>
                    <td></td>
                    <td>
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                    <td colspan="16">
                        <div class="text-left table-ccris">
                            <p>Property Status :
                                <xsl:choose>
                                    <xsl:when test="r:property_status != ''">
                                        <xsl:value-of select="r:property_status"/>
                                    </xsl:when>
                                    <xsl:otherwise>
                                        -
                                    </xsl:otherwise>
                                </xsl:choose>
                            </p>
                            <p>Address Line 1 :
                                <xsl:choose>
                                    <xsl:when test="r:property_add1 != ''">
                                        <xsl:value-of select="r:property_add1"/>
                                    </xsl:when>
                                    <xsl:otherwise>
                                        -
                                    </xsl:otherwise>
                                </xsl:choose>
                            </p>
                            <xsl:if test="r:property_add2 != ''">
                                <p>Address Line 2 :
                                    <xsl:value-of select="r:property_add2"/>
                                </p>
                            </xsl:if>
                            <xsl:if test="r:property_add3 != ''">
                                <p>Address Line 3 :
                                    <xsl:value-of select="r:property_add3"/>
                                </p>
                            </xsl:if>
                            <xsl:if test="r:property_add4 != ''">
                                <p>Address Line 4 :
                                    <xsl:value-of select="r:property_add4"/>
                                </p>
                            </xsl:if>
                            <xsl:if test="r:property_post_code != '' or r:property_city != '' or r:property_state != '' or r:property_country != ''">
                                <p>Postcode/City/State/Country :
                                    <xsl:if test="r:property_post_code != ''">
                                        <xsl:value-of select="r:property_post_code"/>

                                        <xsl:if test="r:property_city != '' or r:property_state != '' or r:property_country != ''">
                                            /
                                        </xsl:if>
                                    </xsl:if>
                                    <xsl:if test="r:property_city != ''">
                                        <xsl:value-of select="r:property_city"/>

                                        <xsl:if test="r:property_state != '' or r:property_country != ''">
                                            /
                                        </xsl:if>
                                    </xsl:if>
                                    <xsl:if test="r:property_state != ''">
                                        <xsl:value-of select="r:property_state"/>

                                        <xsl:if test="r:property_country != ''">
                                            /
                                        </xsl:if>
                                    </xsl:if>
                                    <xsl:if test="r:property_country != ''">
                                        <xsl:value-of select="r:property_country"/>
                                    </xsl:if>
                                </p>
                            </xsl:if>
                        </div>
                    </td>
                </tr>
            </xsl:for-each>
        </xsl:if>

        <xsl:if test="not(r:application)">
            <xsl:call-template name="ccris_details_blank"/>
        </xsl:if>

    </xsl:template>

    <xsl:template match="r:special_attention_accs" mode="specialDetails">
        <xsl:if test="r:special_attention_acc">
            <xsl:for-each select="r:special_attention_acc">
                <tr>
                    <td>
                        <xsl:value-of select="position()"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:approval_date"/>
                    </td>
                    <td></td>
                    <td>
                        <xsl:value-of select="r:capacity/@code"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:lender_type/@code"/>
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:limit"/>
                        </xsl:call-template>
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>
                        <xsl:value-of select="r:legal/@status"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:legal/r:date"/>
                    </td>
                </tr>
                <xsl:apply-templates mode="specialSubs" select="r:sub_accounts"/>
            </xsl:for-each>
        </xsl:if>

        <xsl:if test="not(r:special_attention_acc)">
            <xsl:call-template name="ccris_details_blank"/>
        </xsl:if>

    </xsl:template>

    <xsl:template match="r:sub_accounts" mode="specialSubs">
        <xsl:for-each select="r:sub_account">
            <tr>
                <td></td>
                <td></td>
                <td>
                    <xsl:value-of select="r:cr_positions/r:cr_position[1]/r:status/@code"/>
                </td>
                <td></td>
                <td></td>
                <td>
                    <xsl:value-of select="r:facility/@code"/>
                </td>
                <td>
                    <xsl:call-template name="check_empty_number">
                        <xsl:with-param name="number" select="r:cr_positions/r:cr_position[1]/r:balance"/>
                    </xsl:call-template>
                </td>
                <td>
                    <xsl:value-of select="r:cr_positions/r:cr_position[1]/r:position_date"/>
                </td>
                <td></td>
                <td>
                    <xsl:value-of select="r:repay_term/@code"/>
                </td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        </xsl:for-each>
    </xsl:template>

    <xsl:template match="r:accounts" mode="loanDetails">
        <xsl:if test="r:account">
            <xsl:for-each select="r:account">
                <tr>
                    <xsl:choose>
                        <xsl:when test="r:org1 = '7401' or r:org1 = 'PT'">
                            <td bgcolor="rgb(78,197,115)">
                                <xsl:value-of select="position()"/>
                            </td>
                        </xsl:when>
                        <xsl:otherwise>
                            <td>
                                <xsl:value-of select="position()"/>
                            </td>
                        </xsl:otherwise>
                    </xsl:choose>
                    <td>
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:approval_date"/>
                        </xsl:call-template>
                    </td>
                    <td></td>
                    <td>
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:capacity/@code"/>
                        </xsl:call-template>
                    </td>
                    <td>
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:lender_type/@code"/>
                        </xsl:call-template>
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>
                        <xsl:call-template name="check_empty_number_no_zero">
                            <xsl:with-param name="number" select="r:limit"/>
                        </xsl:call-template>
                    </td>
                    <td></td>
                    <td>
                        <xsl:value-of select="r:collaterals/r:collateral[1]/@code"/>
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>
                        <xsl:value-of select="r:legal/@status"/>

                    </td>
                    <td>
                        <xsl:value-of select="r:legal/r:date"/>
                    </td>
                </tr>
                <xsl:apply-templates mode="colls" select="r:collaterals"/>

                <xsl:apply-templates mode="loanSubs" select="r:sub_accounts"/>

            </xsl:for-each>

            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td>&#160;</td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td>Total Outstanding Balance:</td>
                <td>
                    <xsl:call-template name="check_empty_number_no_zero">
                        <!-- <xsl:with-param name="number" select="//r:summary/r:liabilities/r:borrower"/> -->
                        <xsl:with-param name="number" select="../r:summary/r:liabilities/r:borrower"/>
                    </xsl:call-template>
                </td>
                <td>Total Limit:</td>
                <td>
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="../r:summary/r:liabilities/r:borrower/@total_limit"/>
                    </xsl:call-template>
                </td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        </xsl:if>
    </xsl:template>
    <xsl:template match="r:sub_accounts" mode="loanSubs">
        <xsl:for-each select="r:sub_account">
            <tr>
                <td></td>
                <td>
                    <xsl:if test="r:cr_positions/r:cr_position[1]/r:rescheduled_date != ''">
                        <xsl:value-of select="r:cr_positions/r:cr_position[1]/r:rescheduled_date"/>
                    </xsl:if>
                    <xsl:if test="r:cr_positions/r:cr_position[1]/r:restructured_date != ''">
                        <xsl:value-of select="r:cr_positions/r:cr_position[1]/r:restructured_date"/>
                    </xsl:if>
                </td>
                <td>
                    <xsl:value-of select="r:cr_positions/r:cr_position[1]/r:status/@code"/>
                </td>
                <td></td>
                <td></td>
                <td>
                    <xsl:value-of select="r:facility/@code"/>
                </td>
                <td>
                    <xsl:call-template name="check_empty_number">
                        <xsl:with-param name="number" select="r:cr_positions/r:cr_position[1]/r:balance"/>
                    </xsl:call-template>
                </td>
                <td>
                    <xsl:value-of select="r:cr_positions/r:cr_position[1]/r:position_date"/>
                </td>
                <td>
                    <xsl:call-template name="check_empty_number">
                        <xsl:with-param name="number" select="r:cr_positions/r:cr_position[1]/r:inst_amount"/>
                    </xsl:call-template>
                </td>
                <td>
                    <xsl:value-of select="r:repay_term/@code"/>
                </td>
                <td>
                    <xsl:value-of select="r:collaterals/r:collateral[1]/@code"/>
                </td>

                <xsl:apply-templates mode="inst_arrears" select="r:cr_positions"/>

                <td></td>
                <td></td>
            </tr>
            <xsl:apply-templates mode="colls" select="r:collaterals"/>
        </xsl:for-each>
    </xsl:template>

    <xsl:template match="r:collaterals" mode="colls">
        <xsl:for-each select="r:collateral[position() &gt; 1]">
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td>
                    <xsl:value-of select="@code"/>
                </td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        </xsl:for-each>
    </xsl:template>

    <xsl:template match="r:cr_positions" mode="inst_arrears">
        <xsl:variable name="mth1">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">0</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth2">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">1</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth3">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">2</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth4">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">3</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth5">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">4</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth6">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">5</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth7">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">6</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth8">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">7</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth9">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">8</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth10">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">9</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth11">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">10</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="mth12">
            <xsl:call-template name="getPastMonthAndYearOnly">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                <xsl:with-param name="past">11</xsl:with-param>
            </xsl:call-template>
        </xsl:variable>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth1]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth1]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth1]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth1]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth2]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth2]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth2]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth2]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth3]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth3]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth3]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth3]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth4]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth4]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth4]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth4]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth5]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth5]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth5]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth5]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth6]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth6]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth6]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth6]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth7]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth7]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth7]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth7]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth8]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth8]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth8]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth8]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth9]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth9]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth9]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth9]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth10]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth10]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth10]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth10]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth11]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth11]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth11]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth11]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
            <xsl:when
                    test="r:cr_position[substring(r:position_date,4,7) = $mth12]/r:inst_arrears != '' and r:cr_position[substring(r:position_date,4,7) = $mth12]/r:inst_arrears != '0'">
                <td bgcolor="#FFCCFF">
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth12]/r:inst_arrears"/>
                </td>
            </xsl:when>
            <xsl:otherwise>
                <td>
                    <xsl:value-of select="r:cr_position[substring(r:position_date,4,7) = $mth12]/r:inst_arrears"/>
                </td>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:key name="facility_codes"
             match="r:accounts/r:account/r:sub_accounts/r:sub_account/r:facility | r:special_attention_accs/r:special_attention_acc/r:sub_accounts/r:sub_account/r:facility | r:applications/r:application/r:facility"
             use="concat(ancestor::*[name() = 'section_ccris'][1]/r:summary/@entity_key, '|', @code)"/>
    <xsl:key name="codes"
             match="r:accounts/r:account/r:sub_accounts/r:sub_account/r:cr_positions/r:cr_position/r:status | r:special_attention_accs/r:special_attention_acc/r:sub_accounts/r:sub_account/r:cr_positions/r:cr_position/r:status"
             use="concat(ancestor::*[name() = 'section_ccris'][1]/r:summary/@entity_key, '|', @code)"/>
    <xsl:key name="application_codes" match="r:applications/r:application/r:status" use="@code"/>
    <xsl:key name="legal_status"
             match="r:accounts/r:account/r:legal | r:special_attention_accs/r:special_attention_acc/r:legal"
             use="@status"/>
    <xsl:key name="codesCollateral"
             match="r:accounts/r:account/r:sub_accounts/r:sub_account/r:collaterals/r:collateral | r:special_attention_accs/r:special_attention_acc/r:sub_accounts/r:sub_account/r:collaterals/r:collateral | r:accounts/r:account/r:collaterals/r:collateral"
             use="concat(ancestor::*[name() = 'section_ccris'][1]/r:summary/@entity_key, '|', @code)"/>

    <xsl:template match="r:section_ccris" mode="remarkLegend">
        <div>
            <b>
                <u>
                    REMARK LEGEND
                </u>
            </b>
            <br/>
            <b>
                FACILITY:
            </b>
            <br/>
            <!--            <xsl:apply-templates select="r:accounts/r:account/r:sub_accounts
            | r:special_attention_accs/r:special_attention_acc/r:sub_accounts" mode="groupFacStat"/>-->

            <xsl:variable name="ptptnLoan">
                <xsl:for-each select="r:accounts/r:account">
                    <xsl:choose>
                        <xsl:when test="r:org1 = '7401' or r:org1 = 'PT'">
                            <xsl:value-of select="1"/>
                        </xsl:when>
                        <xsl:otherwise>
                            <xsl:value-of select="0"/>
                        </xsl:otherwise>
                    </xsl:choose>
                </xsl:for-each>
            </xsl:variable>

            <xsl:for-each
                    select="r:accounts/r:account/r:sub_accounts | r:special_attention_accs/r:special_attention_acc/r:sub_accounts">

                <!--<xsl:for-each select="r:sub_account/r:facility[generate-id() = generate-id(key('facility_codes',@code)[1])]">
                    <xsl:if test="@code and translate(@code, ' ', '') != ''">
                        <xsl:value-of select="@code"/> – <xsl:value-of select="."/>

                        <br/>
                    </xsl:if>
                </xsl:for-each>-->

                <xsl:for-each
                        select="r:sub_account/r:facility[count(. | key('facility_codes', concat(ancestor::*[name() = 'section_ccris'][1]/r:summary/@entity_key, '|', @code))[1]) = 1]">

                    <xsl:if test="@code and translate(@code, ' ', '') != ''">
                        <xsl:value-of select="@code"/> –
                        <xsl:value-of select="."/>

                        <br/>
                    </xsl:if>
                </xsl:for-each>

            </xsl:for-each>

            <xsl:for-each select="r:applications">

                <xsl:for-each
                        select="r:application/r:facility[count(. | key('facility_codes', concat(ancestor::*[name() = 'section_ccris'][1]/r:summary/@entity_key, '|', @code))[1]) = 1]">
                    <xsl:if test="@code and translate(@code, ' ', '') != ''">
                        <xsl:value-of select="@code"/> –
                        <xsl:value-of select="."/>

                        <br/>
                    </xsl:if>
                </xsl:for-each>

            </xsl:for-each>

            <xsl:if test="contains($ptptnLoan, '1')">
                Student Loan Identified
                <br/>
            </xsl:if>

            <br/>
            <b>
                LOAN INFOMATION STATUS:
            </b>
            <br/>
            <!--            <xsl:apply-templates select="r:accounts/r:account/r:sub_accounts
            | r:special_attention_accs/r:special_attention_acc/r:sub_accounts" mode="groupLoanStat"/>-->


            <!--<xsl:for-each select="r:accounts/r:account/r:sub_accounts | r:special_attention_accs/r:special_attention_acc/r:sub_accounts">

                <xsl:for-each select="r:sub_account/r:cr_positions/r:cr_position/r:status[generate-id() = generate-id(key('codes',@code)[1])]">
                    <xsl:if test="@code and translate(@code, ' ', '') != ''">
                        <xsl:value-of select="@code"/> – <xsl:value-of select="."/>
                        <br/>
                    </xsl:if>
                </xsl:for-each>

            </xsl:for-each>-->

            <xsl:for-each
                    select="r:accounts/r:account/r:sub_accounts | r:special_attention_accs/r:special_attention_acc/r:sub_accounts">

                <xsl:for-each
                        select="r:sub_account/r:cr_positions/r:cr_position/r:status[count(. | key('codes', concat(ancestor::*[name() = 'section_ccris'][1]/r:summary/@entity_key, '|', @code))[1]) = 1]">
                    <xsl:if test="@code and translate(@code, ' ', '') != ''">
                        <xsl:value-of select="@code"/> –
                        <xsl:value-of select="."/>
                        <br/>
                    </xsl:if>
                </xsl:for-each>

            </xsl:for-each>

            <br/>
            <b>
                COLLATERAL TYPE
            </b>
            <br/>

            <xsl:for-each
                    select="r:accounts/r:account/r:collaterals/r:collateral[count(. | key('codesCollateral', concat(ancestor::*[name() = 'section_ccris'][1]/r:summary/@entity_key, '|', @code))[1]) = 1]">
                <xsl:if test="@code and translate(@code, ' ', '') != ''">
                    <xsl:value-of select="@code"/> –
                    <xsl:value-of select="r:name"/>
                    <br/>
                </xsl:if>
            </xsl:for-each>
            <xsl:for-each
                    select="r:accounts/r:account/r:sub_accounts | r:special_attention_accs/r:special_attention_acc/r:sub_accounts">
                <xsl:for-each
                        select="r:sub_account/r:collaterals/r:collateral[count(. | key('codesCollateral', concat(ancestor::*[name() = 'section_ccris'][1]/r:summary/@entity_key, '|', @code))[1]) = 1]">
                    <xsl:if test="@code and translate(@code, ' ', '') != ''">
                        <xsl:value-of select="@code"/> –
                        <xsl:value-of select="r:name"/>
                        <br/>
                    </xsl:if>
                </xsl:for-each>
            </xsl:for-each>

            <br/>
            <b>
                CREDIT APPLICATION STATUS:
            </b>
            <br/>


            <xsl:for-each select="r:applications">

                <xsl:for-each
                        select="r:application/r:status[generate-id() = generate-id(key('application_codes',@code)[1])]">
                    <xsl:if test="@code and translate(@code, ' ', '') != ''">
                        <xsl:value-of select="@code"/> –
                        <xsl:value-of select="."/>
                        <br/>
                    </xsl:if>
                </xsl:for-each>

            </xsl:for-each>

            <br/>

            <b>
                LEGAL STATUS:
            </b>
            <br/>

            <xsl:for-each select="r:accounts | r:special_attention_accs">

                <xsl:for-each
                        select="r:account/r:legal[generate-id() = generate-id(key('legal_status',@status)[1])] | r:special_attention_acc/r:legal[generate-id() = generate-id(key('legal_status',@status)[1])]">
                    <xsl:if test="@status and translate(@status, ' ', '') != ''">
                        <xsl:value-of select="@status"/> –
                        <xsl:value-of select="r:name"/>
                        <br/>
                    </xsl:if>
                </xsl:for-each>

            </xsl:for-each>

        </div>
    </xsl:template>

    <!--    <xsl:template match="r:sub_accounts" mode="groupLoanStat">
        <xsl:key name="loanStatus" match="r:sub_account/r:cr_positions/r:cr_position" use="r:status/@code"/>
        <xsl:apply-templates mode="outputLoanStatus" select="r:sub_account/r:cr_positions/r:cr_position[
                        generate-id() = generate-id(key('loanStatus', r:status/@code)[1])]"/>
    </xsl:template>
    <xsl:template match="r:cr_position" mode="outputLoanStatus">
        <xsl:value-of select="r:status/@code"/> – <xsl:value-of select="r:status"/>
        <br/>
        <xsl:text>&#10;</xsl:text>
    </xsl:template>-->

    <!--    <xsl:template match="r:sub_accounts" mode="groupFacStat">
        <xsl:key name="facStatus" match="r:sub_account" use="r:facility/@code"/>
        <xsl:apply-templates mode="outputFacStatus" select="r:sub_account[
                        generate-id() = generate-id(key('facStatus', r:facility/@code)[1])]"/>
    </xsl:template>
    <xsl:template match="r:sub_account" mode="outputFacStatus">
        <xsl:value-of select="r:facility/@code"/> – <xsl:value-of select="r:facility"/>
        <br/>
        <xsl:text>&#10;</xsl:text>
    </xsl:template>-->

    <xsl:template name="sumNodes">
        <xsl:param name="index" select="1"/>
        <xsl:param name="nodes"/>
        <xsl:param name="total" select="0"/>
        <xsl:variable name="currentValue">
            <xsl:choose>
                <xsl:when test="$nodes[$index][text() != '']">
                    <xsl:variable name="chkNumber" select="translate($nodes[$index], ',', '')"/>
                    <xsl:choose>
                        <xsl:when test="number($chkNumber) = $chkNumber and starts-with($chkNumber, '-') = false">
                            <xsl:value-of select="$chkNumber"/>
                        </xsl:when>
                        <xsl:otherwise>
                            <xsl:value-of select="0"/>
                        </xsl:otherwise>
                    </xsl:choose>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:choose>
            <xsl:when test="$index=count($nodes)">
                <xsl:value-of select="$total + $currentValue"/>
            </xsl:when>
            <xsl:otherwise>
                <xsl:if test="count($nodes) &gt; 0">
                    <xsl:call-template name="sumNodes">
                        <xsl:with-param name="index" select="$index + 1"/>
                        <xsl:with-param name="total" select="$total + $currentValue"/>
                        <xsl:with-param name="nodes" select="$nodes"/>
                    </xsl:call-template>
                </xsl:if>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template name="check_boolean">
        <xsl:param name="input"/>
        <xsl:choose>
            <xsl:when test="$input = 1">
                <xsl:value-of select="'Y'"/>
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="'N'"/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template name="addNumbersNoZero">
        <xsl:param name="num1"/>
        <xsl:param name="num2"/>
        <xsl:variable name="value1">
            <xsl:choose>
                <xsl:when test="string-length($num1) &gt; 0">
                    <xsl:variable name="chkNumber" select="translate($num1, ',', '')"/>
                    <xsl:choose>
                        <xsl:when test="number($chkNumber) = $chkNumber">
                            <xsl:value-of select="$chkNumber"/>
                        </xsl:when>
                        <xsl:otherwise>
                            <xsl:value-of select="0"/>
                        </xsl:otherwise>
                    </xsl:choose>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="value2">
            <xsl:choose>
                <xsl:when test="string-length($num2) &gt; 0">
                    <xsl:variable name="chkNumber" select="translate($num2, ',', '')"/>
                    <xsl:choose>
                        <xsl:when test="number($chkNumber) = $chkNumber">
                            <xsl:value-of select="$chkNumber"/>
                        </xsl:when>
                        <xsl:otherwise>
                            <xsl:value-of select="0"/>
                        </xsl:otherwise>
                    </xsl:choose>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:choose>
            <xsl:when test="($value1 + $value2) != 0">
                <xsl:value-of select="format-number($value1 + $value2,'##,##0.00')"/>

            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="'0.00'"/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template name="getPastMonthFirstLetter">
        <xsl:param name="datestr"/>
        <xsl:param name="past"/>
        <xsl:variable name="currMth">
            <xsl:value-of select="substring($datestr,6,2)"/>
        </xsl:variable>
        <xsl:variable name="month">
            <xsl:choose>
                <xsl:when test="($currMth - $past) &lt;= 0">
                    <xsl:value-of select="$currMth - $past + 12"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="$currMth - $past"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:if test="$month = 1">
            <xsl:text>J</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 2">
            <xsl:text>F</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 3">
            <xsl:text>M</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 4">
            <xsl:text>A</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 5">
            <xsl:text>M</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 6">
            <xsl:text>J</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 7">
            <xsl:text>J</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 8">
            <xsl:text>A</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 9">
            <xsl:text>S</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 10">
            <xsl:text>O</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 11">
            <xsl:text>N</xsl:text>
        </xsl:if>
        <xsl:if test="$month = 12">
            <xsl:text>D</xsl:text>
        </xsl:if>
    </xsl:template>

    <xsl:template name="getYearOnly">
        <xsl:param name="datestr"/>
        <xsl:variable name="yyyy">
            <xsl:value-of select="substring($datestr,1,4)"/>
        </xsl:variable>
        <xsl:value-of select="$yyyy"/>
    </xsl:template>

    <xsl:template name="getPastMonthAndYearOnly">
        <xsl:param name="datestr"/>
        <xsl:param name="past"/>
        <xsl:variable name="mth">
            <xsl:value-of select="substring($datestr,6,2)"/>
        </xsl:variable>
        <xsl:variable name="yyyy">
            <xsl:value-of select="substring($datestr,1,4)"/>
        </xsl:variable>
        <xsl:variable name="mthyyyy">
            <xsl:choose>
                <xsl:when test="($mth - $past) &lt;= 0">
                    <xsl:value-of select="concat(format-number($mth - $past + 12,'00'),'-',$yyyy - 1)"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="concat(format-number($mth - $past,'00'),'-',$yyyy)"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:value-of select="$mthyyyy"/>
    </xsl:template>

    <!-- start ccris_details_blank -->
    <xsl:template name="ccris_details_blank">
        <tr>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
            <td>&#160;</td>
        </tr>
    </xsl:template>
    <!-- finish ccris_details_blank -->

    <xsl:template match="r:section_dcheqs">

        <p class="header">
            DISHONOURED CHEQUE INFORMATION (OWN BANK)
        </p>

        <table class="table">
            <tr>
                <th width="15%">Account No.</th>
                <th width="15%">Issuance Date</th>
                <th width="15%">Cheque No.</th>
                <th width="20%">Amount</th>
                <th width="35%">Remark</th>
            </tr>
            <xsl:for-each select="r:dcheque_owns/r:dcheque_own">
                <tr>
                    <td>
                        <xsl:value-of select="r:account_no"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:issue_date"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:cheque_no"/>
                    </td>
                    <td>
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                    <td>
                        <xsl:value-of select="r:remarks"/>
                    </td>
                </tr>
            </xsl:for-each>
        </table>
        <br/>

        <p class="header">
            DISHONOURED CHEQUE INFORMATION (COMMERCIAL BANK)
        </p>

        <table class="table">
            <tr>
                <th width="20%">Bank</th>
                <th width="20%">Account No.</th>
                <th width="20%">Issuance Date</th>
                <th width="40%">Remark</th>
            </tr>
            <xsl:for-each select="r:dcheques/r:dcheque">
                <tr>
                    <td>
                        <xsl:value-of select="r:bank_no"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:account_no"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:issue_date"/>
                    </td>
                    <td>
                        <xsl:value-of select="r:remarks"/>
                    </td>
                </tr>
            </xsl:for-each>
        </table>
        <br/>
    </xsl:template>

    <xsl:template match="r:section_ccris_supp">

        <table class="table">
            <tr>
                <td class="title" colspan="5">ADDRESS INFORMATION</td>
            </tr>
            <tr>
                <td class="header text-center" width="2%">No.</td>
                <td class="header text-center" width="48%">Address</td>
                <td class="header text-center" width="20%">State</td>
                <td class="header text-center" width="15%">Postcode</td>
                <td class="header text-center" width="15%">Created Date</td>
            </tr>
            <xsl:choose>
                <xsl:when test="r:addresses/r:address">

                    <xsl:for-each select="r:addresses/r:address">
                        <xsl:variable name="seq" select="position()"/>
                        <tr>
                            <td>
                                <xsl:value-of select="$seq"/>.
                            </td>
                            <td>
                                <xsl:value-of select="r:long_address"/>
                            </td>
                            <td class="text-center">
                                <xsl:value-of select="r:address6"/>
                            </td>
                            <td class="text-center">
                                <xsl:value-of select="r:post_code"/>
                            </td>
                            <td class="text-center">
                                <xsl:value-of select="r:create_date"/>
                            </td>
                        </tr>
                    </xsl:for-each>
                </xsl:when>
                <xsl:otherwise>
                    <tr>
                        <td colspan="5">No Information Available</td>
                    </tr>
                </xsl:otherwise>
            </xsl:choose>
        </table>
        <br/>

        <table class="table">
            <tr>
                <td class="title" colspan="3">CONTACT INFORMATION</td>
            </tr>
            <tr>
                <td class="header text-center" width="2%">No.</td>
                <td class="header text-center" width="83%">Contact Number</td>
                <td class="header text-center" width="15%">Created Date</td>
            </tr>
            <xsl:choose>
                <xsl:when test="r:contacts/r:contact">
                    <xsl:for-each select="r:contacts/r:contact">
                        <xsl:variable name="seq" select="position()"/>
                        <tr>
                            <td>
                                <xsl:value-of select="$seq"/>.
                            </td>
                            <td>
                                <xsl:value-of select="r:phone_no"/>
                            </td>
                            <td class="text-center">
                                <xsl:value-of select="r:create_date"/>
                            </td>
                        </tr>
                    </xsl:for-each>
                </xsl:when>
                <xsl:otherwise>
                    <tr>
                        <td colspan="3">No Information Available</td>
                    </tr>
                </xsl:otherwise>
            </xsl:choose>
        </table>
        <br/>

        <table class="table">
            <tr>
                <td class="title" colspan="6">OCCUPATION INFORMATION</td>
            </tr>
            <tr>
                <td class="header text-center" width="2%">No.</td>
                <td class="header text-center" width="25%">Occupation</td>
                <td class="header text-center" width="25%">Employer</td>
                <td class="header text-center" width="15%">From Date</td>
                <td class="header text-center" width="15%">To Date</td>
                <td class="header text-center" width="15%">Created Date</td>
            </tr>
            <xsl:choose>
                <xsl:when test="r:occupations/r:occupation">
                    <xsl:for-each select="r:occupations/r:occupation">
                        <xsl:variable name="seq" select="position()"/>
                        <tr>
                            <td>
                                <xsl:value-of select="$seq"/>.
                            </td>
                            <td>
                                <xsl:value-of select="r:occupation"/>
                            </td>
                            <td>
                                <xsl:value-of select="r:employer"/>
                            </td>
                            <td class="text-center">
                                <xsl:value-of select="r:from_date"/>
                            </td>
                            <td class="text-center">
                                <xsl:value-of select="r:to_date"/>
                            </td>
                            <td class="text-center">
                                <xsl:value-of select="r:create_date"/>
                            </td>
                        </tr>
                    </xsl:for-each>
                </xsl:when>
                <xsl:otherwise>
                    <tr>
                        <td colspan="6">No Information Available</td>
                    </tr>
                </xsl:otherwise>
            </xsl:choose>
        </table>
        <br/>
    </xsl:template>

    <xsl:template name="r:section_c3_subreport_angkasa_information">
        <table class="table">
            <tr>
                <th class="caption">Matched Name</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:section_angkasa/r:information/r:matched_name"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Matched New IC No</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:section_angkasa/r:information/r:matched_new_ic"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Matched Old IC No</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:section_angkasa/r:information/r:matched_old_ic"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Status</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:section_angkasa/r:information/r:status"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Remarks</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:section_angkasa/r:information/r:remark"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Account ID / Reference</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:section_angkasa/r:information/r:reference_no"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Salary No</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:section_angkasa/r:information/r:salary_no"/>
                    </xsl:call-template>
                </td>
            </tr>
        </table>
        <br/>
    </xsl:template>

    <xsl:template name="r:section_c3_subreport_angkasa_monthly_deduction">
        <p class="title">
            ANGKASA MONTHLY DEDUCTION
        </p>
        <xsl:if test="not(r:section_angkasa/r:monthly_deduction/r:itemise/r:item)">
            <p class="info">No Information Available</p>
        </xsl:if>
        <xsl:if test="r:section_angkasa/r:monthly_deduction/r:itemise/r:item">
            <p class="notice">
                NOTE: The following information is provided by third party sources for your reference. ANGKASA does not
                guarantee the accuracy of the information. Please check with the Creditors for confirmation. Users
                should NOT treat the information as conclusive factor for evaluation purpose.
            </p>
            <table class="table">
                <tr>
                    <td width="3%" class="header text-center">No.</td>
                    <td width="28%" class="header text-center">Organization</td>
                    <td width="7%" class="header text-center">Code</td>
                    <td width="27%" class="header text-center">Type</td>
                    <td width="7%" class="header text-center">Account Status</td>
                    <td width="7%" class="header text-center">Begin</td>
                    <td width="7%" class="header text-center">End</td>
                    <td width="7%" class="header text-center">Deduction Amount</td>
                    <td width="7%" class="header text-center">Total Amount</td>
                </tr>
                <xsl:for-each select="r:section_angkasa/r:monthly_deduction/r:itemise/r:item">
                    <tr>
                        <td class="text-center">
                            <b>
                                <xsl:value-of select="position()"/>.
                            </b>
                        </td>
                        <td class="text-left">
                            <b>
                                <xsl:value-of select="r:org_name"/>
                            </b>
                        </td>
                        <td class="text-center">
                            <b>
                                <xsl:value-of select="r:org_no"/>
                            </b>
                        </td>
                        <td class="text-center">
                            <br/>
                        </td>
                        <td class="text-center">
                            <b>
                                <xsl:value-of select="r:org_status"/>
                            </b>
                        </td>
                        <td class="text-center">
                            <br/>
                        </td>
                        <td class="text-center">
                            <br/>
                        </td>
                        <td class="text-right">
                            <br/>
                        </td>
                        <td class="text-right">
                            <b>
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:org_deduction_amount"/>
                                </xsl:call-template>
                            </b>
                        </td>
                    </tr>
                    <xsl:for-each select="r:details/r:detail">
                        <tr>
                            <td class="text-center">
                                <br/>
                            </td>
                            <td class="text-left">
                                <br/>
                            </td>
                            <td class="text-center">
                                <br/>
                            </td>
                            <td class="text-left">
                                <xsl:value-of select="r:type"/>
                            </td>
                            <td class="text-center">
                                <br/>
                            </td>
                            <td class="text-center">
                                <xsl:value-of select="r:begin"/>
                            </td>
                            <td class="text-center">
                                <xsl:value-of select="r:end"/>
                            </td>
                            <td class="text-right">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:deduction_amount"/>
                                </xsl:call-template>
                            </td>
                            <td class="text-right">
                                <br/>
                            </td>
                        </tr>
                    </xsl:for-each>
                </xsl:for-each>
                <tr>
                    <td colspan="8" class="caption text-right">
                        <b>TOTAL DEDUCTION:</b>
                    </td>
                    <td class="caption text-right">
                        <b>
                            <xsl:call-template name="check_empty_number">
                                <xsl:with-param name="number"
                                                select="r:section_angkasa/r:monthly_deduction/r:total_deduction"/>
                            </xsl:call-template>
                        </b>
                    </td>
                </tr>
            </table>
        </xsl:if>
        <br/>
    </xsl:template>

    <xsl:template name="r:section_c3_subreport_angkasa_pending_deduction">
        <p class="title">
            ANGKASA PENDING DEDUCTION
        </p>
        <xsl:if test="not(r:section_angkasa/r:pending_deduction/r:details/r:detail)">
            <p class="info">No Information Available</p>
        </xsl:if>
        <xsl:if test="r:section_angkasa/r:pending_deduction/r:details/r:detail">
            <table class="table">
                <tr>
                    <td width="3%" class="header text-center">No.</td>
                    <td width="69%" class="header text-center">Organization</td>
                    <td width="7%" class="header text-center">Code</td>
                    <td width="7%" class="header text-center">Account Status</td>
                    <td width="7%" class="header text-center">Start Date</td>
                    <td width="7%" class="header text-center">Deduction Amount</td>
                </tr>
                <xsl:for-each select="r:section_angkasa/r:pending_deduction/r:details/r:detail">
                    <tr>
                        <td class="text-center">
                            <xsl:value-of select="position()"/>.
                        </td>
                        <td class="text-left">
                            <xsl:value-of select="r:org_name"/>
                        </td>
                        <td class="text-center">
                            <xsl:value-of select="r:org_no"/>
                        </td>
                        <td class="text-center">
                            <xsl:value-of select="r:org_status"/>
                        </td>
                        <td class="text-center">
                            <xsl:value-of select="r:start_date"/>
                        </td>
                        <td class="text-right">
                            <xsl:call-template name="check_empty_number">
                                <xsl:with-param name="number" select="r:deduction_amount"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                </xsl:for-each>
                <tr>
                    <td colspan="5" class="caption text-right">
                        <b>TOTAL PENDING DEDUCTION:</b>
                    </td>
                    <td class="caption text-right">
                        <b>
                            <xsl:call-template name="check_empty_number">
                                <xsl:with-param name="number"
                                                select="r:section_angkasa/r:pending_deduction/r:total_pending_deduction"/>
                            </xsl:call-template>
                        </b>
                    </td>
                </tr>
            </table>
        </xsl:if>
        <br/>
    </xsl:template>

    <xsl:template name="r:section_c3_subreport_angkasa_payment_history">
        <p class="title">
            ANGKASA PAYMENT HISTORY
        </p>
        <xsl:if test="not(r:section_angkasa/r:payment_history/r:payment_month/r:item[1])">
            <p class="info">No Information Available</p>
        </xsl:if>
        <xsl:if test="r:section_angkasa/r:payment_history/r:payment_month/r:item[1]">
            <table class="table-small">
                <tr>
                    <td width="2%" class="header-small text-center">Code</td>
                    <td width="2%" class="header-small text-center">Deduction Month</td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[1]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[2]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[3]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[4]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[5]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[6]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[7]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[8]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[9]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[10]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[11]"/>
                    </td>
                    <td width="8%" class="header-small text-center">
                        <xsl:value-of select="r:section_angkasa/r:payment_history/r:payment_month/r:item[12]"/>
                    </td>
                </tr>
                <xsl:for-each select="r:section_angkasa/r:payment_history/r:payment_detail/r:item">
                    <tr>
                        <td class="caption text-center" rowspan="2">
                            <b>
                                <xsl:value-of select="r:code"/>
                            </b>
                        </td>
                        <td class="caption text-center">
                            <b>Date Process</b>
                        </td>
                        <xsl:if test="r:process_date/r:item[1] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[1]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[1] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[1]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[2] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[2]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[2] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[2]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[3] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[3]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[3] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[3]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[4] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[4]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[4] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[4]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[5] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[5]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[5] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[5]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[6] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[6]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[6] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[6]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[7] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[7]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[7] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[7]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[8] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[8]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[8] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[8]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[9] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[9]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[9] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[9]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[10] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[10]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[10] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[10]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[11] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[11]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[11] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[11]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[12] != '-'">
                            <td class="text-center">
                                <xsl:value-of select="r:process_date/r:item[12]"/>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:process_date/r:item[12] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:value-of select="r:process_date/r:item[12]"/>
                            </td>
                        </xsl:if>
                    </tr>
                    <tr>
                        <td class="caption text-center">
                            <b>Amount</b>
                        </td>
                        <xsl:if test="r:amount/r:item[1] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[1]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[1] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[1]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[2] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[2]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[2] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[2]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[3] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[3]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[3] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[3]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[4] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[4]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[4] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[4]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[5] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[5]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[5] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[5]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[6] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[6]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[6] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[6]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[7] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[7]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[7] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[7]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[8] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[8]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[8] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[8]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[9] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[9]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[9] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[9]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[10] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[10]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[10] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[10]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[11] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[11]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[11] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[11]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[12] != '-'">
                            <td class="text-center">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[12]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                        <xsl:if test="r:amount/r:item[12] = '-'">
                            <td class="text-center" bgcolor="#FFCCFF">
                                <xsl:call-template name="check_empty_number">
                                    <xsl:with-param name="number" select="r:amount/r:item[12]"/>
                                </xsl:call-template>
                            </td>
                        </xsl:if>
                    </tr>
                </xsl:for-each>
            </table>
        </xsl:if>
        <br/>
    </xsl:template>
</xsl:stylesheet>