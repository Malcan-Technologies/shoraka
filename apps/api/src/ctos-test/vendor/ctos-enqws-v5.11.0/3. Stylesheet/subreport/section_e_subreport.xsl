<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/response"
                xmlns:exslt="http://exslt.org/common"
                exclude-result-prefixes="xsl r">

    <xsl:template name="section_e_template">
    
            
        <p class="title">
            E1: ETR PLUS (NON-BANK PAYMENT HISTORY)
        </p>
        <p class="info" style="background-color: #DDDDDD;">ETR Plus is a non-bank payment information shared by third party sources. It serves as additional information
         	(other than banking payment history) to help in your credit assessment.
            <br/><br/>
            Note: The following information is provided by the third party sources for your reference. Searched Subject will also include transaction(s) that are
            under Guarantor capacity. CTOS does not gurantee the accuracy of the information as listed debts may have been settled since recorded.
            </p>
            <xsl:variable name="seq">
	        	<xsl:value-of select="@seq"/>
	       	</xsl:variable>
            <xsl:if test="(//r:summary/r:enq_sum/r:include_etr_plus = '2')">
            	<p class="info">
                   This section is for eTR Plus contributor only. To find out how you can contribute to get access, please contact us at
                   <a href = "mailto: etrplus@ctos.com.my">etrplus@ctos.com.my</a>.
                </p>
                <br/>
        	</xsl:if>
        	
        	<xsl:if test="(//r:summary/r:enq_sum/r:include_etr_plus = '0')">
            	<p class="info">Not Selected</p>
	            <br/>
        	</xsl:if>
	        
	        <xsl:if test="(//r:summary/r:enq_sum[@seq = $seq]/r:include_etr_plus = '1') and (//r:enquiry[@seq = $seq]/r:section_etr_plus[@data = 'true']) "> 
	           	<xsl:call-template name="etr_plus_account_profile_template"/>
	            <br/>
	            <xsl:call-template name="etr_plus_payment_history_template"/>
	            <br/>
	            <xsl:call-template name="non_blank_lender_credit_information_template"/>
	            <br/>
	        </xsl:if>
	        
	        <xsl:if test="(//r:enquiry[@seq = $seq]/r:section_etr_plus[@data = 'false']) and (//r:summary/r:enq_sum[@seq = $seq]/r:include_etr_plus != '2') and (//r:summary/r:enq_sum[@seq = $seq]/r:include_etr_plus != '0') or not(//r:summary/r:enq_sum[@seq = $seq]/r:include_etr_plus)">
	            
	            <p class="info">No Information Available</p>
	            <br/>
	            
	        </xsl:if>
        
        
        <p class="title">
            E2: TRADE REFERENCE
        </p>

        <xsl:choose>
            <xsl:when test="//r:section_e/@data = 'true'">

                <xsl:call-template name="trade_reference_summary_template"/>

                <xsl:for-each select="//r:section_e/r:enquiry">

                    <xsl:variable name="ref_com_name">
                        <xsl:choose>
                            <xsl:when test="r:subject/r:ref_com_name">
                                <xsl:value-of select="r:subject/r:ref_com_name"/>
                            </xsl:when>
                            <xsl:otherwise>
                                <xsl:value-of select="r:sponsor/r:ref_com_name"/>
                            </xsl:otherwise>
                        </xsl:choose>
                    </xsl:variable>

                    <xsl:variable name="ref_com_bus">
                        <xsl:choose>
                            <xsl:when test="r:subject/r:ref_com_bus">
                                <xsl:value-of select="r:subject/r:ref_com_bus"/>
                            </xsl:when>
                            <xsl:otherwise>
                                <xsl:value-of select="r:sponsor/r:ref_com_bus"/>
                            </xsl:otherwise>
                        </xsl:choose>
                    </xsl:variable>

                    <xsl:call-template name="new_trade_reference_relationship_template"/>
                    <xsl:call-template name="new_trade_reference_sponsor_template"/>
                    <xsl:call-template name="new_trade_reference_account_status_template"/>
                    <xsl:call-template name="new_trade_reference_return_cheque_template"/>
                    <xsl:call-template name="new_trade_reference_legal_action_template"/>
                    <xsl:call-template name="new_trade_reference_cra_comment_template"/>
                    <xsl:call-template name="new_trade_reference_subject_comment_template"/>
                    <xsl:call-template name="new_trade_reference_contact_template">
                        <xsl:with-param name="referee" select="$ref_com_name"/>
                        <xsl:with-param name="nature_of_business" select="$ref_com_bus"/>
                    </xsl:call-template>

                </xsl:for-each>
                <br/>
            </xsl:when>
            <xsl:when test="//r:tr_report/r:enquiry">
                <xsl:for-each select="//r:tr_report/r:header">
                    <xsl:variable name="ref_com_name">
                        <xsl:value-of select="r:ref_com_name"/>
                    </xsl:variable>

                    <xsl:variable name="ref_com_bus">
                        <xsl:value-of select="r:ref_com_bus"/>
                    </xsl:variable>
                    <xsl:if test="(
                    ((//r:enq_report/r:summary/r:enq_sum[@seq = $seq]/r:ic_lcno != '') and (//r:enq_report/r:summary/r:enq_sum[@seq = $seq]/r:ic_lcno = r:ic_lcno))
                    or
                    ((//r:enq_report/r:summary/r:enq_sum[@seq = $seq]/r:nic_brno != '') and (//r:enq_report/r:summary/r:enq_sum[@seq = $seq]/r:nic_brno = r:nic_brno))
                    )">
                        <xsl:for-each select="../r:enquiry/r:section">
                            <xsl:call-template name="trade_reference_relationship_template"/>
                            <xsl:call-template name="trade_reference_sponsor_template"/>
                            <xsl:call-template name="trade_reference_account_status_template"/>
                            <xsl:call-template name="trade_reference_return_cheque_template"/>
                            <xsl:call-template name="trade_reference_legal_action_template"/>
                            <xsl:call-template name="trade_reference_cra_comment_template"/>
                            <xsl:call-template name="trade_reference_subject_comment_template"/>
                            <xsl:call-template name="trade_reference_contact_template">
                                <xsl:with-param name="referee" select="$ref_com_name"/>
                                <xsl:with-param name="nature_of_business" select="$ref_com_bus"/>
                            </xsl:call-template>
                        </xsl:for-each>
                    </xsl:if>
                </xsl:for-each>
                <br/>
            </xsl:when>
            <xsl:otherwise>

                <p class="info">No Information Available</p>

                <br/>

            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template name="trade_reference_summary_template">
        <p class="header">Summary</p>

        <table class="table">
            <tr class="header caption text-center">
                <td>No</td>
                <td>Referee</td>
                <td>Account No.</td>
                <td>Capacity</td>
                <td>Statement Date</td>
                <td>Default Amount (RM)</td>
            </tr>
            <xsl:for-each select="//r:section_e/r:enquiry">
                <tr class="text-center">
                    <td>
                        <xsl:value-of select="@seq"/>
                    </td>
                    <td>
                        <xsl:choose>
                            <xsl:when test="r:subject/r:ref_com_name != ''">
                                <xsl:value-of select="r:subject/r:ref_com_name"/>
                            </xsl:when>
                            <xsl:when test="r:subject/r:ref_com_name != ''">
                                <xsl:value-of select="r:sponsor/r:ref_com_name"/>
                            </xsl:when>
                            <xsl:otherwise>
                                -
                            </xsl:otherwise>
                        </xsl:choose>
                    </td>
                    <td>
                        <xsl:choose>
                            <xsl:when test="r:account_status/r:account_no != ''">
                                <xsl:value-of select="r:account_status/r:account_no"/>
                            </xsl:when>
                            <xsl:otherwise>
                                -
                            </xsl:otherwise>
                        </xsl:choose>
                    </td>
                    <td>
                        <xsl:choose>
                            <xsl:when test="r:subject/r:name != ''">
                                PERSONAL
                            </xsl:when>
                            <xsl:when test="r:sponsor/r:name != ''">
                                <xsl:choose>
                                    <xsl:when test="r:sponsor/r:name = 'Joint Owner'">
                                        Joint
                                    </xsl:when>
                                    <xsl:otherwise>
                                        Guarantor
                                    </xsl:otherwise>
                                </xsl:choose>
                            </xsl:when>
                            <xsl:otherwise>
                                -
                            </xsl:otherwise>
                        </xsl:choose>
                    </td>
                    <td>
                        <xsl:value-of select="r:account_status/r:statement_date"/>
                    </td>
                    <td>
                        <xsl:variable name="total">
                            <xsl:value-of select="string(number(
                                r:account_status/r:age/r:age_90 + r:account_status/r:age/r:age_120 +
                                r:account_status/r:age/r:age_150 + r:account_status/r:age/r:age_180 +
                                r:account_status/r:age/r:age_over_180
                            ))"/>
                        </xsl:variable>

                        <xsl:value-of select="format-number($total,'##,##0.00')" />
                    </td>
                </tr>
            </xsl:for-each>
        </table>
        <br/>
    </xsl:template>

    <!-- start trade_reference_relationship -->
    <xsl:template name="trade_reference_relationship_template">
        
        <xsl:if test="@id = 'relationship'">
            <p class="header">The following information are in relation to Account No: <xsl:value-of select="r:data[@name = 'account_no']"/></p>
        
            <table class="table">
                <tr>
                    <td class="header caption text-left">
                        <xsl:value-of select="position()"/>. Relationship</td>
                    <td class="short-content">
                        Subject is <xsl:value-of select="r:data[@name = 'rel_type']"/>
                    </td>
                        
                    <td class="header caption text-left">Relationship Start Date</td>
                    <td class="short-content">
                        <xsl:call-template name="default_empty_string">
                            <xsl:with-param name="value" select="r:data[@name = 'rel_sday']"/>
                        </xsl:call-template>
                            &#160;
                        <xsl:call-template name="month_name_template">
                            <xsl:with-param name="month" select="r:data[@name = 'rel_smonth']"/>
                        </xsl:call-template>
                            &#160;
                        <xsl:call-template name="default_empty_string">
                            <xsl:with-param name="value" select="r:data[@name = 'rel_syear']"/>
                        </xsl:call-template>
                    </td>
                </tr>
            </table>                        
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish trade_reference_relationship -->

    <!-- start trade_reference_sponsor -->
    <xsl:template name="trade_reference_sponsor_template">
        
        <xsl:if test="@id = 'sponsor' and r:record">
            
            <p class="notice">To the best of our knowledge, we have the following info:</p>
            
            <table class="table">
                <tr>
                    <th class="caption" width="20px">No.</th>
                    <th class="caption">Name</th>
                    <th class="caption">New ID / Old ID</th>
                    <th class="caption">Type</th>
                    <th class="caption">Source</th>
                    <th class="caption">Date</th>
                </tr>
                
                <xsl:for-each select="r:record">
                    <tr>
                        <td width="20px">
                            <xsl:value-of select="@seq"/>.
                        </td>
                        <td>
                            <xsl:value-of select="r:data[@name = 'name']"/>
                        </td>
                        <td>
                            <xsl:if test="r:data[@name = 'nic_brno'] != '' and r:data[@name = 'ic_lcno'] = ''">
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:data[@name = 'nic_brno']"/>
                                </xsl:call-template>
                            </xsl:if>
                            <xsl:if test="r:data[@name = 'nic_brno'] = '' and r:data[@name = 'ic_lcno'] != ''">
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:data[@name = 'ic_lcno']"/>
                                </xsl:call-template>
                            </xsl:if>
                            <xsl:if test="r:data[@name = 'nic_brno'] != '' and r:data[@name = 'ic_lcno'] != ''">
                                <xsl:value-of select="r:data[@name = 'ic_lcno']"/> / <xsl:value-of select="r:data[@name = 'nic_brno']"/>
                            </xsl:if>
                        </td>
                        <td>
                            <xsl:value-of select="r:data[@name = 'type']"/>
                            <xsl:if test="r:data[@name = 'guarantor'] = '1'">
                                (GUARANTOR)
                            </xsl:if>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'source']"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'date']"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                </xsl:for-each>
                
            </table>

        </xsl:if>
        
    </xsl:template>
    <!-- finish trade_reference_sponsor -->

    <!-- start trade_reference_account_status -->
    <xsl:template name="trade_reference_account_status_template">
        
        <xsl:if test="(@id = 'account_status')">
            
            <br/>
            
            <table class="table">
                <tr>
                    <td class="header caption text-left">
                        <xsl:value-of select="position() - 1"/>. Aging Information</td>
                    <td class="long-content" colspan="3">
                        <xsl:if test="r:data[@name = 'statement_date'] != ''">
                            As At Statement Date: <xsl:value-of select="r:data[@name = 'statement_date']"/>
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'statement_date'] = ''">
                            Not Provided
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name of Debtor</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:data[@name = 'debtor_name']"/>
                        <xsl:if test="r:data[@name = 'debtor_nic_brno'] != '' and r:data[@name = 'debtor_ic_lcno'] != ''">
                            (<xsl:value-of select="r:data[@name = 'debtor_nic_brno']"/> / <xsl:value-of select="r:data[@name = 'debtor_ic_lcno']"/>)
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'debtor_nic_brno'] != '' and r:data[@name = 'debtor_ic_lcno'] = ''">
                            (<xsl:value-of select="r:data[@name = 'debtor_nic_brno']"/>)
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'debtor_nic_brno'] = '' and r:data[@name = 'debtor_ic_lcno'] != ''">
                            (<xsl:value-of select="r:data[@name = 'debtor_ic_lcno']"/>)
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Credit Terms</th>
                    <td class="short-content">
                        <xsl:if test="r:data[@name = 'account_term'] &gt; '0'">
                            <xsl:value-of select="r:data[@name = 'account_term']"/> Days
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'account_term'] = '0'">
                            CASH
                        </xsl:if>
                    </td>
                    <th class="caption">Credit Limit</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:data[@name = 'account_limit']"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Account Status</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:data[@name = 'account_status']"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:data[@name = 'address']"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Nature of Debt</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:data[@name = 'debt_type']"/>
                    </td>
                </tr>
            </table>
            
            <br/>    
                        
            <table class="table-no-background-color">
                <tr class="table-no-background-color-text-center">
                    <th colspan="2" style="background-color: #C5E0B3;">Outstanding</th>
                    <th colspan="5" style="background-color: #FFCCFF;">Default</th>
                </tr>
                <tr class="table-no-background-color-text-center">
                    <th style="background-color: #C5E0B3;">0-30 Days</th>
                    <th style="background-color: #C5E0B3;">31-60 Days</th>
                    <th style="background-color: #FFCCFF;">61-90 Days</th>
                    <th style="background-color: #FFCCFF;">91-120 Days</th>
                    <th style="background-color: #FFCCFF;">121-150 Days</th>
                    <th style="background-color: #FFCCFF;">151-180 Days</th>
                    <th style="background-color: #FFCCFF;">> 180 Days</th>
                </tr>
                <tr class="table-text-right">
                    <xsl:for-each select="r:data[@name = 'age']/r:item">
                        <td>
                            <xsl:call-template name="check_empty_number">
                                <xsl:with-param name="number" select="."/>
                            </xsl:call-template>
                        </td>
                    </xsl:for-each>
                </tr>
            </table>
                
            <p class="notice">The above was accurate as at the statement date indicate above.</p>
            
            <br/>    
                        
            <table class="table">
                <tr>
                    <td class="header caption text-left">Account Conduct</td>
                </tr>
            </table>
            <table class="table-text-center">                
                <tr>
                    <th>Not Provided</th>
                    <th>Excellent</th>
                    <th>Good</th>
                    <th>Satisfactory</th>
                    <th>Unsatisfactory</th>
                </tr>
                <tr>
                    <td>
                        <xsl:if test="r:data[@name = 'account_rating'] = '0'">
                            X
                        </xsl:if>
                    </td>
                    <td>
                        <xsl:if test="r:data[@name = 'account_rating'] = '1'">
                            X
                        </xsl:if>
                    </td>
                    <td>
                        <xsl:if test="r:data[@name = 'account_rating'] = '2'">
                            X
                        </xsl:if>
                    </td>
                    <td>
                        <xsl:if test="r:data[@name = 'account_rating'] = '3'">
                            X
                        </xsl:if>
                    </td>
                    <td>
                        <xsl:if test="r:data[@name = 'account_rating'] = '4'">
                            X
                        </xsl:if>
                    </td>
                </tr>
            </table>                                   
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish trade_reference_account_status -->

    <!-- start trade_reference_return_cheque -->
    <xsl:template name="trade_reference_return_cheque_template">
        
        <xsl:if test="@id = 'return_cheque'">
        
            <br/>
            
            <table class="table">
                <tr>
                    <td class="header caption text-left" colspan="7">
                        <xsl:value-of select="position() - 1"/>. Returned Cheque History</td>
                </tr>
            </table>
        
        </xsl:if>
        
        <xsl:if test="@id = 'return_cheque' and r:record and @status != 'Not Provided'">
                
            <table class="table-text-center">
                <tr>
                    <th>Cheque No.</th>
                    <th>Account No.</th>
                    <th>Bank</th>
                    <th>Amount (RM)</th>
                    <th>Date Returned</th>
                    <th>Reason</th>
                    <th>Cheque Issuer</th>
                </tr>
                <xsl:for-each select="r:record">
                    <tr>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'cheque_no']"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'cheque_acc_no']"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'cheque_bank']"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_number">
                                <xsl:with-param name="number" select="r:data[@name = 'cheque_amount']"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'cheque_date']"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'cheque_reason']"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'cheque_issuer']"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                </xsl:for-each>
            </table>
            
            <p class="notice">The above cheques were received for payment of amount owed but were returned unpaid for reasons indicated.</p>                       
            
        </xsl:if>
        
        <xsl:if test="@id = 'return_cheque' and @status = 'Not Provided'">
            <p class="info">No Information Available</p>
        </xsl:if>
        
    </xsl:template>
    <!-- finish trade_reference_return_cheque -->

    <!-- start trade_reference_legal_action -->
    <xsl:template name="trade_reference_legal_action_template">
        
        <xsl:if test="@id = 'legal_action'">
        
            <br/>
            
            <table class="table">
                <tr>
                    <td class="header caption text-left" colspan="2">
                        <xsl:value-of select="position() - 1"/>. Reminders / Letter of Demand for Payment / General Remarks</td>
                </tr>
            </table>
        
        </xsl:if>
        
        <xsl:if test="@id = 'legal_action' and r:record and @status != 'Not Provided'">
                
            <table class="table">
                <xsl:for-each select="r:record">
                    <tr>
                        <td class="caption text-left">
                            <xsl:value-of select="r:data[@name = 'title']"/>
                        </td>
                        <td>
                            <xsl:value-of select="r:data[@name = 'date']"/>
                            &#160;
                            <xsl:value-of select="r:data[@name = 'comment']"/>
                        </td>
                    </tr>
                </xsl:for-each>
            </table>
            
        </xsl:if>        
        
        <xsl:if test="@id = 'legal_action' and @status = 'Not Provided'">
            <p class="info">No Information Available</p>
        </xsl:if>
        
    </xsl:template>
    <!-- finish trade_reference_legal_action -->

    <!-- start trade_reference_cra_comment -->
    <xsl:template name="trade_reference_cra_comment_template">
		
        <xsl:if test="@id = 'cra_comment'">            
            
            <br/>
            
            <table class="table">
                <tr>
                    <td class="header caption text-left">
                        <xsl:value-of select="position() - 1"/>. CRA Comment</td>
                    <td class="long-content">
                        <xsl:if test="r:data[@name = 'cra_status_desc'] != ''">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'cra_status_desc']"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'cra_status_desc'] = ''">
                            No Information Available
                        </xsl:if>
                    </td>
                </tr>                    
            </table>            
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish trade_reference_cra_comment -->

    <!-- start trade_reference_subject_comment -->
    <xsl:template name="trade_reference_subject_comment_template">
		
        <xsl:if test="@id = 'subject_comment'">            
            
            <br/>
            
            <table class="table">
                <tr>
                    <td class="header caption text-left">
                        <xsl:value-of select="position() - 1"/>. Subject's Comment</td>
                    <td class="long-content">
                        <xsl:if test="r:data[@name = 'subject_comment'] != ''">
                            <pre>
                                <xsl:call-template name="replace_string">
                                    <xsl:with-param name="value" select="r:data[@name = 'subject_comment']"/>
                                    <xsl:with-param name="replace" select="'               '"/>
                                    <xsl:with-param name="with" select="''"/>
                                </xsl:call-template>
                            </pre>
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'subject_comment'] = ''">
                            No Information Available
                        </xsl:if>
                    </td>
                </tr>                    
            </table>                                   
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish trade_reference_subject_comment -->

    <!-- start trade_reference_contact -->
    <xsl:template name="trade_reference_contact_template">
        <xsl:param name="referee"/>
        <xsl:param name="nature_of_business"/>
		
        <xsl:if test="@id = 'contact'">                    
                        
            <br/>
            
            <table class="table">
                <tr>
                    <td class="header caption text-left" colspan="2">
                        <xsl:value-of select="position() - 1"/>. Referee's Information</td>
                </tr>
                <tr>
                    <th class="caption">Referee</th>
                    <td>
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="$referee"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Contact Name</th>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:data[@name = 'name']"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:data[@name = 'address']"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>

                    <th class="caption">
                        <xsl:if test="r:data[@name = 'type_code'] = '1' or r:data[@name = 'type_code'] >= '4'">
                            Telephone
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'type_code'] = '2'">
                            Fax
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'type_code'] = '3'">
                            Email
                        </xsl:if>
                    </th>
                    <td class="long-content">
                        <xsl:if test="r:data[@name = 'type_code'] = '1' or r:data[@name = 'type_code'] >= '4'">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'tel_no']"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'type_code'] = '2'">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'fax_no']"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="r:data[@name = 'type_code'] = '3'">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:data[@name = 'email']"/>
                            </xsl:call-template>
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Nature of Business</th>
                    <td>
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="$nature_of_business"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remarks</th>
                    <td></td>
                </tr>
            </table>                        
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish trade_reference_contact -->

    <!-- start new trade_reference_relationship -->
    <xsl:template name="new_trade_reference_relationship_template">

        <xsl:if test="r:relationship">

            <p class="header">The following information are in relation to Account No: <xsl:value-of select="r:relationship/r:account_no"/></p>

            <table class="table">
                <tr>
                    <td class="header caption text-left">
                        1. Relationship</td>
                    <td class="short-content">
                        Subject is <xsl:value-of select="r:relationship/r:rel_type"/>
                    </td>

                    <td class="header caption text-left">Relationship Start Date</td>
                    <td class="short-content">
                        <xsl:call-template name="default_empty_string">
                            <xsl:with-param name="value" select="r:relationship/r:rel_sday"/>
                        </xsl:call-template>
                            &#160;
                        <xsl:call-template name="month_name_template">
                            <xsl:with-param name="month" select="r:relationship/r:rel_smonth"/>
                        </xsl:call-template>
                            &#160;
                        <xsl:call-template name="default_empty_string">
                            <xsl:with-param name="value" select="r:relationship/r:rel_syear"/>
                        </xsl:call-template>
                    </td>
                </tr>
            </table>

        </xsl:if>

    </xsl:template>
    <!-- finish new trade_reference_relationship -->

    <!-- start new trade_reference_sponsor -->
    <xsl:template name="new_trade_reference_sponsor_template">

        <xsl:if test="r:sponsor">

            <xsl:if test="r:sponsor != ''">
                <p class="notice">To the best of our knowledge, we have the following info:</p>

                <table class="table">
                    <tr>
                        <th class="caption" width="10px">No.</th>
                        <th class="caption">Name</th>
                        <th class="caption">New ID / Old ID</th>
                        <th class="caption">Type</th>
                        <th class="caption">Source</th>
                        <th class="caption">Date</th>
                    </tr>

                    <tr>
                        <td width="20px">
                            1.
                        </td>
                        <td>
                            <xsl:value-of select="r:sponsor/r:name"/>
                        </td>
                        <td>
                            <xsl:choose>
                                <xsl:when test="r:sponsor/r:nic_brno != '' and r:sponsor/r:ic_lcno = ''">
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:sponsor/r:nic_brno"/>
                                    </xsl:call-template>
                                </xsl:when>
                                <xsl:when test="r:sponsor/r:nic_brno = '' and r:sponsor/r:ic_lcno != ''">
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:sponsor/r:ic_lcno"/>
                                    </xsl:call-template>
                                </xsl:when>
                                <xsl:otherwise>
                                    <xsl:value-of select="r:sponsor/r:nic_brno"/> / <xsl:value-of select="r:sponsor/r:ic_lcno"/>
                                </xsl:otherwise>
                            </xsl:choose>
                        </td>
                        <td>
                            <xsl:value-of select="r:sponsor/r:sp_type"/>
                            <xsl:if test="r:sponsor/r:guarantor = '1'">
                                (GUARANTOR)
                            </xsl:if>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:sponsor/r:sp_source"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:sponsor/r:date"/>
                            </xsl:call-template>
                        </td>
                    </tr>

                </table>
            </xsl:if>

        </xsl:if>

    </xsl:template>
    <!-- finish new trade_reference_sponsor -->

    <!-- start new trade_reference_account_status -->
    <xsl:template name="new_trade_reference_account_status_template">

        <xsl:if test="r:account_status">

            <br/>

            <table class="table">
                <tr>
                    <td class="header caption text-left">
                        2. Aging Information</td>
                    <td class="long-content" colspan="3">
                        <xsl:choose>
                            <xsl:when test="r:account_status/r:statement_date != ''">
                                As At Statement Date: <xsl:value-of select="r:account_status/r:statement_date"/>
                            </xsl:when>
                            <xsl:otherwise>
                                Not Provided
                            </xsl:otherwise>
                        </xsl:choose>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name of Debtor</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:account_status/r:debtor_name"/>
                        <xsl:if test="r:account_status/r:debtor_nic_brno != '' and r:account_status/r:debtor_ic_lcno != ''">
                            (<xsl:value-of select="r:account_status/r:debtor_nic_brno"/> / <xsl:value-of select="r:account_status/r:debtor_ic_lcno"/>)
                        </xsl:if>
                        <xsl:if test="r:account_status/r:debtor_nic_brno != '' and r:account_status/r:debtor_ic_lcno = ''">
                            (<xsl:value-of select="r:account_status/r:debtor_nic_brno"/>)
                        </xsl:if>
                        <xsl:if test="r:account_status/r:debtor_nic_brno = '' and r:account_status/r:debtor_ic_lcno != ''">
                            (<xsl:value-of select="r:account_status/r:debtor_ic_lcno"/>)
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Credit Terms</th>
                    <td class="short-content">
                        <xsl:choose>
                            <xsl:when test="r:account_status/r:account_term > '0'">
                                <xsl:value-of select="r:account_status/r:account_term"/> Days
                            </xsl:when>
                            <xsl:when test="r:account_status/r:account_term = '0'">
                                cash
                            </xsl:when>
                            <xsl:otherwise>
                                -
                            </xsl:otherwise>
                        </xsl:choose>
                    </td>
                    <th class="caption">Credit Limit (RM)</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_and_format_currency">
                            <xsl:with-param name="value" select="r:account_status/r:account_limit"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Account Status</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:account_status/r:account_status"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Account Reference No.</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:account_status/r:account_ref_no"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:account_status/r:address"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Nature of Debt</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:account_status/r:debt_type"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Last Paid Amount (RM)</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_and_format_currency">
                            <xsl:with-param name="value" select="r:account_status/r:last_paid_amount"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remarks</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:relationship/r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>

            </table>

            <br/>

            <table class="table-no-background-color">
                <tr class="table-no-background-color-text-center">
                    <th colspan="2" style="background-color: #C5E0B3;">Outstanding</th>
                    <th colspan="5" style="background-color: #FFCCFF;">Default</th>
                </tr>
                <tr class="table-no-background-color-text-center">
                    <th style="background-color: #C5E0B3;">0-30 Days</th>
                    <th style="background-color: #C5E0B3;">31-60 Days</th>
                    <th style="background-color: #FFCCFF;">61-90 Days</th>
                    <th style="background-color: #FFCCFF;">91-120 Days</th>
                    <th style="background-color: #FFCCFF;">121-150 Days</th>
                    <th style="background-color: #FFCCFF;">151-180 Days</th>
                    <th style="background-color: #FFCCFF;">> 180 Days</th>
                </tr>
                <tr class="table-text-right">
                        <td>
                            <xsl:call-template name="check_empty_and_format_currency">
                                <xsl:with-param name="value" select="r:account_status/r:age/r:age_30"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_and_format_currency">
                                <xsl:with-param name="value" select="r:account_status/r:age/r:age_60"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_and_format_currency">
                                <xsl:with-param name="value" select="r:account_status/r:age/r:age_90"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_and_format_currency">
                                <xsl:with-param name="value" select="r:account_status/r:age/r:age_120"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_and_format_currency">
                                <xsl:with-param name="value" select="r:account_status/r:age/r:age_150"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_and_format_currency">
                                <xsl:with-param name="value" select="r:account_status/r:age/r:age_180"/>
                            </xsl:call-template>
                        </td>
                        <td>
                            <xsl:call-template name="check_empty_and_format_currency">
                                <xsl:with-param name="value" select="r:account_status/r:age/r:age_over_180"/>
                            </xsl:call-template>
                        </td>
                </tr>
            </table>

            <p class="notice">The above was accurate as at the statement date indicate above.</p>

            <br/>

            <table class="table">
                <tr>
                    <td class="header caption text-left">Account Conduct</td>
                </tr>
            </table>
            <table class="table-text-center">
                <tr>
                    <th>Not Provided</th>
                    <th>Excellent</th>
                    <th>Good</th>
                    <th>Satisfactory</th>
                    <th>Unsatisfactory</th>
                </tr>
                <tr>
                    <td>
                        <xsl:if test="r:account_status/r:account_rating[@code = '0']">
                            X
                        </xsl:if>
                    </td>
                    <td>
                        <xsl:if test="r:account_status/r:account_rating[@code = '1']">
                            X
                        </xsl:if>
                    </td>
                    <td>
                        <xsl:if test="r:account_status/r:account_rating[@code = '2']">
                            X
                        </xsl:if>
                    </td>
                    <td>
                        <xsl:if test="r:account_status/r:account_rating[@code = '3']">
                            X
                        </xsl:if>
                    </td>
                    <td>
                        <xsl:if test="r:account_status/r:account_rating[@code = '4']">
                            X
                        </xsl:if>
                    </td>
                </tr>
            </table>

        </xsl:if>

    </xsl:template>
    <!-- finish new trade_reference_account_status -->

    <!-- start new trade_reference_return_cheque -->
    <xsl:template name="new_trade_reference_return_cheque_template">

        <xsl:if test="r:return_cheques">

            <br/>

            <table class="table">
                <tr>
                    <td class="header caption text-left" colspan="7">
                        3. Returned Cheque History</td>
                </tr>
            </table>

            <table class="table-text-center">
                <tr>
                    <th>Cheque No.</th>
                    <th>Account No.</th>
                    <th>Bank</th>
                    <th>Amount (RM)</th>
                    <th>Date Returned</th>
                    <th>Reason</th>
                    <th>Cheque Issuer</th>
                </tr>

                <xsl:if test="r:return_cheques/r:record">
                    <xsl:for-each select="r:return_cheques/r:record">
                        <tr>
                            <td>
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:cheque_no"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:cheque_acc_no"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:cheque_bank"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:call-template name="check_empty_and_format_currency">
                                    <xsl:with-param name="value" select="r:cheque_amount"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:cheque_date"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:cheque_reason"/>
                                </xsl:call-template>
                            </td>
                            <td>
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:cheque_issuer"/>
                                </xsl:call-template>
                            </td>
                        </tr>
                    </xsl:for-each>
                </xsl:if>
            </table>

            <xsl:choose>
                <xsl:when test="r:return_cheques/r:record != ''">
                    <p class="notice">The above cheques were received for payment of amount owed but were returned unpaid for reasons indicated.</p>
                </xsl:when>
                <xsl:otherwise>
                    <p class="info">No Information Available</p>
                </xsl:otherwise>
            </xsl:choose>

        </xsl:if>
    </xsl:template>
    <!-- finish new trade_reference_return_cheque -->

    <!-- start new trade_reference_legal_action -->
    <xsl:template name="new_trade_reference_legal_action_template">

        <xsl:if test="r:legal_action">

            <br/>

            <table class="table">
                <tr>
                    <td class="header caption text-left" colspan="2">
                        4. Reminders / Letter of Demand for Payment / General Remarks</td>
                </tr>
            </table>

            <xsl:choose>
                <xsl:when test="r:legal_action/r:reminder_letter != '' or r:legal_action/r:demand_letter_by_company != ''
                    or r:legal_action/r:demand_letter_by_lawyer != ''">

                    <table class="table">

                        <xsl:if test="r:legal_action/r:reminder_letter != ''">
                            <tr>
                                <td class="caption text-left">
                                    <xsl:value-of select="r:legal_action/r:reminder_letter/r:title"/>
                                </td>
                                <td>
                                    <!-- if test comment and date -->
                                    <xsl:if test="r:legal_action/r:reminder_letter/r:reference">
                                        <xsl:value-of select="r:legal_action/r:reminder_letter/r:reference"/>
                                        &#160;
                                    </xsl:if>
                                    <xsl:value-of select="r:legal_action/r:reminder_letter/r:date"/>
                                </td>
                            </tr>
                        </xsl:if>
                        <xsl:if test="r:legal_action/r:demand_letter_by_company != ''">
                            <tr>
                                <td class="caption text-left">
                                    <xsl:value-of select="r:legal_action/r:demand_letter_by_company/r:title"/>
                                </td>
                                <td>
                                    <!-- if test comment and date -->
                                    <xsl:if test="r:legal_action/r:demand_letter_by_company/r:reference">
                                        <xsl:value-of select="r:legal_action/r:demand_letter_by_company/r:reference"/>
                                        &#160;
                                    </xsl:if>
                                    <xsl:value-of select="r:legal_action/r:demand_letter_by_company/r:date"/>
                                </td>
                            </tr>
                        </xsl:if>
                        <xsl:if test="r:legal_action/r:demand_letter_by_lawyer != ''">
                            <tr>
                                <td class="caption text-left">
                                    <xsl:value-of select="r:legal_action/r:demand_letter_by_lawyer/r:title"/>
                                </td>
                                <td>
                                    <!-- if test comment and date -->
                                    <xsl:if test="r:legal_action/r:demand_letter_by_lawyer/r:reference">
                                        <xsl:value-of select="r:legal_action/r:demand_letter_by_lawyer/r:reference"/>
                                        &#160;
                                    </xsl:if>
                                    <xsl:value-of select="r:legal_action/r:demand_letter_by_lawyer/r:date"/>
                                </td>
                            </tr>
                        </xsl:if>
                    </table>

                </xsl:when>
                <xsl:otherwise>
                    <p class="info">No Information Available</p>
                </xsl:otherwise>
            </xsl:choose>

        </xsl:if>

    </xsl:template>
    <!-- finish new trade_reference_legal_action -->

    <!-- start new trade_reference_cra_comment -->
    <xsl:template name="new_trade_reference_cra_comment_template">

        <xsl:if test="r:cra_comment">

            <br/>

            <table class="table">
                <tr>
                    <td class="header caption text-left">
                        5. CRA Comment</td>
                    <td class="long-content">
                        <xsl:choose>
                            <xsl:when test="r:cra_comment/r:cra_status_desc">
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:cra_comment/r:cra_status_desc"/>
                                </xsl:call-template></xsl:when>
                            <xsl:otherwise>
                                No Information Available
                            </xsl:otherwise>
                        </xsl:choose>
                    </td>
                </tr>
            </table>

        </xsl:if>

    </xsl:template>
    <!-- finish new trade_reference_cra_comment -->

    <!-- start new trade_reference_subject_comment -->
    <xsl:template name="new_trade_reference_subject_comment_template">

        <xsl:if test="r:subject_comments">

            <br/>

            <table class="table">
                <tr>
                    <td class="header caption text-left">
                        6. Subject's Comment</td>
                    <td class="long-content">
                        <xsl:choose>
                            <xsl:when test="r:subject_comments != ''">
                                <pre>
                                    <xsl:call-template name="replace_string">
                                        <xsl:with-param name="value" select="r:subject_comments/r:subject_comment"/>
                                        <xsl:with-param name="replace" select="'               '"/>
                                        <xsl:with-param name="with" select="''"/>
                                    </xsl:call-template>
                                </pre>
                            </xsl:when>
                            <xsl:otherwise>
                                No Information Available
                            </xsl:otherwise>
                        </xsl:choose>
                    </td>
                </tr>
            </table>

        </xsl:if>

    </xsl:template>
    <!-- finish trade_reference_subject_comment -->

    <!-- start new trade_reference_contact -->
    <xsl:template name="new_trade_reference_contact_template">
        <xsl:param name="referee"/>
        <xsl:param name="nature_of_business"/>

        <xsl:if test="r:referee_contact">

            <br/>

            <table class="table">
                <tr>
                    <td class="header caption text-left" colspan="2">
                        7. Referee's Information</td>
                </tr>	
                <tr>
                    <th class="caption">Referee</th>
                    <td>
                  	 	<xsl:call-template name="check_empty_string">
                          	<xsl:with-param name="value" select="$referee"/>
                    	</xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Contact Name</th>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:referee_contact/r:contact_name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:referee_contact/r:contact_add"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">
                        Telephone
                    </th>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:referee_contact/r:contact_telno"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:if test="referee_contact/r:contact_faxno">
                    <tr>
                        <th class="caption">
                            Fax
                        </th>
                        <td class="long-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:referee_contact/r:contact_faxno"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                </xsl:if>
                <xsl:if test="referee_contact/r:contact_email">
                    <tr>
                        <th class="caption">
                            Email
                        </th>
                        <td class="long-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:referee_contact/r:contact_email"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                </xsl:if>
                <tr>
                    <th class="caption">Nature of Business</th>
                    <td>
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="$nature_of_business"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remarks</th>
                    <td class="long-content">
                        -
                    </td>
                </tr>
            </table>
            <br/>
        </xsl:if>

    </xsl:template>
    <!-- finish trade_reference_contact -->

    <!-- start etr_plus_account_profile_template -->
    <xsl:template name="etr_plus_account_profile_template">
    	<xsl:variable name="seq">
	    	<xsl:value-of select="@seq"/>
	    </xsl:variable>
    	<br/>
    	<table class="table">
    		<tr>
	    		<td colspan="12" style="background-color: #666666; color:#FFFFFF"><strong>1a. Account Payment Profile</strong> - Varying payments (Static snapshot)</td>
	    	</tr>
	    	<xsl:choose>
	    	<xsl:when test="//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile">
	    	<tr>
	    		<td class="header text-center" rowspan="2" style="font-size:7px">Industry Segment</td>
	    		<td class="header text-center" rowspan="2" style="font-size:7px">Account No</td>
	    		<td class="header text-center" rowspan="2" style="font-size:7px">Payment Term</td>
	    		<td class="header text-center" rowspan="2" nowrap="Col Type" style="font-size:7px">Col Type</td>
	    		<td class="header text-center" rowspan="2" nowrap="As at Due" style="font-size:7px">As at Due</td>
	    		<td class="header text-center" rowspan="2" nowrap="Amount Due" style="font-size:7px">Amount Due</td>
	    		<td class="header text-center" rowspan="2" nowrap="Within Term" style="font-size:7px">Within Term</td>
	    		<td class="header text-center" colspan="5" style="font-size:7px">Payment Overdue</td>
	        </tr>
	        <tr>
	        	<td class="header text-center" nowrap="1-30 days" style="font-size:7px">1-30 days</td>
	        	<td class="header text-center" nowrap="31-60 days" style="font-size:7px">31-60 days</td>
	        	<td class="header text-center" nowrap="61-90 days" style="font-size:7px">61-90 days</td>
	        	<td class="header text-center" nowrap="91-120 days" style="font-size:7px">91-120 days</td>
	        	<td class="header text-center" nowrap=">120 days" style="font-size:7px">>120 days</td>
	        </tr>
	        
	        
		        <xsl:for-each select="//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile">
		        	<tr>
		        		<td class="text-center" style="font-size:7px">
                        	<xsl:value-of select="r:industry"/>
		        		</td>
		        		<td class="text-center" style="font-size:7px">
                        	<xsl:value-of select="r:account"/>
		        		</td>
		        		<td class="text-center" style="font-size:7px">
                        	<xsl:value-of select="r:paymentTerm"/>
		        		</td>
		        		<td class="text-center" style="font-size:7px">
                        	<xsl:value-of select="r:collateralType"/>
		        		</td>
		        		<td class="text-center" nowrap="r:asAtDate" style="font-size:7px">
		        			<xsl:if test="r:asAtDate != ''">
		        				<xsl:variable name="dt" select="r:asAtDate"/>
							  		<xsl:value-of select="concat(
									    substring($dt,9,2),'-',
									    substring($dt,6,2),'-',
									    substring($dt,1,4))" />
		        			</xsl:if>
		        		</td>
		        		<td class="text-center" style="font-size:7px">
		        			<xsl:if test="r:amountDue != ''">
                        		 <xsl:call-template name="check_empty_number">
                                 	<xsl:with-param name="number" select="r:amountDue"/>
                                 </xsl:call-template>
                        	</xsl:if>
		        		</td>
		        		<xsl:choose>
				        		<xsl:when test="r:withinTerm = 'S' or r:withinTerm = 's'">
									<td class="text-center" style="background-color: #A9D18E; font-size:7px">
				        				<xsl:text>S</xsl:text>
				        			</td>
								</xsl:when>
								<xsl:when test="r:withinTerm = 'W' or r:withinTerm = 'w'">
									<td class="text-center" style="background-color: #FE7676; font-size:7px">
				        				<xsl:text>W</xsl:text>
				        			</td>
								</xsl:when>
								<xsl:otherwise>
		                        	<td class="text-center" style="font-size:7px">
			                        	<xsl:value-of select="r:withinTerm"/>
			                        	<xsl:text>%</xsl:text>
					        		</td>
		                        </xsl:otherwise>
	                    </xsl:choose>
		        		<td class="text-center" style="font-size:7px">
                        	<xsl:value-of select="r:age1to30"/>
                        	<xsl:text>%</xsl:text>
		        		</td>
		        		<td class="text-center" style="font-size:7px">
                        	<xsl:value-of select="r:age31to60"/>
                        	<xsl:text>%</xsl:text>
		        		</td>
		        		<td class="text-center" style="font-size:7px">
                        	<xsl:value-of select="r:age61to90"/>
                        	<xsl:text>%</xsl:text>
		        		</td>
		        		<td class="text-center" style="font-size:7px">
                        	<xsl:value-of select="r:age91to120"/>
                        	<xsl:text>%</xsl:text>
		        		</td>
		        		<td class="text-center" style="font-size:7px">
                        	<xsl:value-of select="r:ageOver120"/>
                        	<xsl:text>%</xsl:text>
		        		</td>
		        	</tr>
		        </xsl:for-each>
	        </xsl:when>
            <xsl:otherwise>
            	<td class="vertical-center">
                		No Information Available
                </td>
            </xsl:otherwise>
            </xsl:choose>
        </table>      
    </xsl:template>
    <!-- finish etr_plus_account_profile_template -->
    
    <!-- start etr_plus_payment_history_template -->
    <xsl:template name="etr_plus_payment_history_template">
    	<xsl:variable name="seq">
	    	<xsl:value-of select="@seq"/>
	    </xsl:variable>
        <!-- START COUNT COLLATERAL TYPE -->
        <xsl:variable name="countCLE">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'CLE']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countPROP">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'PROP']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countDPS">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'DPS']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countQSHA">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'QSHA']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countUNQSHA">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'UNQSHA']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countUNT">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'UNT']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countOFA">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'OFA']) &gt; '0'">
                    <xsl:value-of select="2"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countMTV">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'MTV']) &gt; '0'">
                    <xsl:value-of select="2"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countOTV">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'OTV']) &gt; '0'">
                    <xsl:value-of select="2"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countCONC">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'CONC']) &gt; '0'">
                    <xsl:value-of select="3"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countPAM">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'PAM']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countFG">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'FG']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countNP">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'NP']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countSL">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'SL']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countOAS">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'OAS']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countSEC">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusAccountProfileList/r:etrPlusAccountProfile/r:collateralType[text() = 'SEC']) &gt; '0'">
                    <xsl:value-of select="2"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countCollateralType">
            <xsl:value-of select="$countCLE+$countPROP+$countDPS+$countQSHA+$countUNQSHA
        	+$countUNT+$countOFA+$countMTV+$countOTV+$countCONC+$countPAM
        	+$countFG+$countNP+$countSL+$countOAS+$countSEC"></xsl:value-of>
        </xsl:variable>
        <!-- END COUNT COLLATERAL -->
        <!-- START COUNT STATUS -->
        <xsl:variable name="countStatusS">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusPaymentHistoryList/r:etrPlusPaymentHistory/r:monthDetailsList/r:monthDetails/r:payment[text() = 's']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countStatusW">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusPaymentHistoryList/r:etrPlusPaymentHistory/r:monthDetailsList/r:monthDetails/r:payment[text() = 'w']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countStatus">
            <xsl:value-of select="$countStatusS+$countStatusW"/>
        </xsl:variable>
        <!-- END COUNT STATUS -->
        <xsl:variable name="largestNumber">
            <xsl:choose>
                <xsl:when test="$countCollateralType &gt; 4">
                    <xsl:value-of select="$countCollateralType"></xsl:value-of>
                </xsl:when>
                <xsl:when test="$countStatus &gt; 4">
                    <xsl:value-of select="$countStatus"></xsl:value-of>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="4"></xsl:value-of>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
    	<table class="table">
    		<tr>
	    		<td colspan="16" style="background-color: #666666; color:#FFFFFF"><strong>1b. Payment Trend</strong> - Varying payments (Last 12 months)</td>
	    	</tr>
	    	<xsl:choose>
	    	<xsl:when test="//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusPaymentHistoryList/r:etrPlusPaymentHistory">
	        <tr>
	        	<td class="header text-center" style="font-size:7px">Industry Segment</td>
	        	<td class="header text-center" style="font-size:7px">Account No</td>
	        	<td class="header text-center" style="font-size:7px">Payment Term</td>
	        	<td class="header text-center" style="font-size:7px">Capacity</td>
				<td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">1</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">2</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">3</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">4</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">5</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">6</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">7</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">8</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">9</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">10</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">11</xsl:with-param>
                    </xsl:call-template>
                </td>
                <td class="header text-center" style="font-size:7px">
                    <xsl:call-template name="getPastMonthAndYearOnly_section_e">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">12</xsl:with-param>
                    </xsl:call-template>
                </td>
			</tr>
	        <xsl:for-each select="//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusPaymentHistoryList/r:etrPlusPaymentHistory">
	        	<tr>
	        		<td class="text-center" style="font-size:7px">
                        <xsl:value-of select="r:industry"/>
		        	</td>
		        	<td class="text-center" style="font-size:7px">
                        <xsl:value-of select="r:account"/>
		        	</td>
		        	<td class="text-center" style="font-size:7px">
                        <xsl:value-of select="r:paymentTerm"/>
		        	</td>
		        	<td class="text-center" nowrap="r:capacity" style="font-size:7px">
                        <xsl:value-of select="r:capacity"/>
		        	</td>
		        		<xsl:variable name="countMonth">
					    	<xsl:value-of select="count(r:monthDetailsList/r:monthDetails)"/>
					    </xsl:variable>
					    <xsl:variable name="remainingMonth">
			                <xsl:value-of select="12 - $countMonth"/>
			            </xsl:variable>
		        		<xsl:for-each select="r:monthDetailsList/r:monthDetails">
		        				<xsl:if test="$countMonth = '12'">
						        	<xsl:choose>
						        		<xsl:when test="(substring(r:payment,2) = '+') or r:payment &gt; '0' ">
											<td class="text-center" style="font-size:7px; background-color: #FE7676;">
												<xsl:value-of select="r:payment"/>
											</td>
										</xsl:when>
										<xsl:when test="r:payment = 'W' or r:payment = 'w' ">
											<td class="text-center" style="font-size:7px; background-color: #FE7676;">
												<xsl:text>W</xsl:text>
											</td>
										</xsl:when>
										<xsl:when test="r:payment = 'S' or r:payment = 's'">
											<td class="text-center" style="font-size:7px; background-color: #A9D18E;">
												<xsl:text>S</xsl:text>
											</td>
										</xsl:when>
										<xsl:when test="r:payment = '0' or r:payment = '-'">
											<td class="text-center" style="font-size:7px;">
												<xsl:value-of select="r:payment"/>
											</td>
										</xsl:when>
										<xsl:otherwise>
					                        <td style="background-color: #DDDDDD;">
											</td>
					                    </xsl:otherwise>
				                    </xsl:choose>
			                    </xsl:if>
			                    <xsl:if test="$countMonth &lt; '12'">
			                    	<xsl:variable name="i" select="position()">
					    			</xsl:variable>
			                    	<xsl:choose>
						        		<xsl:when test="(substring(r:payment,2) = '+') or r:payment &gt; '0' ">
											<td class="text-center" style="font-size:7px; background-color: #FE7676;">
												<xsl:value-of select="r:payment"/>
											</td>
										</xsl:when>
										<xsl:when test="r:payment = 'W' or r:payment = 'w'">
											<td class="text-center" style="font-size:7px; background-color: #FE7676;">
												<xsl:text>W</xsl:text>
											</td>
										</xsl:when>
										<xsl:when test="r:payment = 'S' or r:payment = 's'">
											<td class="text-center" style="font-size:7px; background-color: #A9D18E;">
												<xsl:text>S</xsl:text>
											</td>
										</xsl:when>
										<xsl:when test="r:payment = '0' or r:payment = '-'">
											<td class="text-center" style="font-size:7px;">
												<xsl:value-of select="r:payment"/>
											</td>
										</xsl:when>
										<xsl:otherwise>
					                        <td style="background-color: #DDDDDD;">
											</td>
					                    </xsl:otherwise>
				                    </xsl:choose>
				                    <xsl:if test="12 - $remainingMonth = $i">
				                        <xsl:choose>
				                        	<xsl:when test="$remainingMonth = '1'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '2'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '3'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '4'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '5'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '6'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '7'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '8'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '9'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '10'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '11'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        </xsl:choose>
				                	</xsl:if>
			                    </xsl:if>
						</xsl:for-each>
	        	</tr>
	        </xsl:for-each>
                <tr>
                    <th colspan="2" width="2%" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-right: none; border-bottom: none;"></th>
                    <th colspan="12" width="2%" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-right: none; border-left: none; border-bottom: none;"></th>
                    <th colspan="2" width="2%" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-left: none; border-bottom: none;"></th>
                </tr>
                <tr>
                    <td colspan="2" style="padding: 0px 0px 0px 6px; border-top: none;  border-right: none;  border-bottom: none; background-color: #DDDDDD;">
                        <table>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption"><strong>Remark Legend:</strong></td>
                            </tr>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- No Data</td>
                            </tr>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">0 No Overdue</td>
                            </tr>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">1 1-30 Days Overdue</td>
                            </tr>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">2 31-60 Days Overdue</td>
                            </tr>
                            <xsl:if test="$largestNumber - 4 &gt; '0'">
                                <xsl:for-each select="(//node())[position() &lt;= ($largestNumber - 4)]">
                                    <tr>
                                        <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;</td>
                                    </tr>
                                </xsl:for-each>
                            </xsl:if>
                        </table>
                    </td>
                    <td colspan="2" style="padding: 0px 0px 0px 6px; border: none; background-color: #DDDDDD;">
                        <table>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">3 61-90 Days Overdue</td>
                            </tr>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">4 91-120 Days Overdue</td>
                            </tr>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">5 121-150 Days Overdue</td>
                            </tr>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">6 151-180 Days Overdue</td>
                            </tr>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">6+ >180 Days Overdue</td>
                            </tr>
                            <xsl:if test="$largestNumber - 4 &gt; '0'">
                                <xsl:for-each select="(//node())[position() &lt;= ($largestNumber - 4)]">
                                    <tr>
                                        <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;</td>
                                    </tr>
                                </xsl:for-each>
                            </xsl:if>
                        </table>
                    </td>
                    <td colspan="6" style="padding: 0px 0px 0px 6px; border: none; background-color: #DDDDDD;">
                        <table>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">Personal - Transaction incurred by Subject</td>
                            </tr>
                            <tr>
                                <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">Non-Personal - Transaction where the Subject is a Guarantor / Joint Owner</td>
                            </tr>
                            <xsl:if test="$largestNumber - 1 &gt; '0'">
                                <xsl:for-each select="(//node())[position() &lt;= ($largestNumber - 1)]">
                                    <tr>
                                        <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;</td>
                                    </tr>
                                </xsl:for-each>
                            </xsl:if>
                        </table>
                    </td>
                    <td colspan="3" style="padding: 0px 0px 0px 6px; border: none; background-color: #DDDDDD;">
                        <table>
                            <tr>
                                <th class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption"><strong>Collateral Type</strong></th>
                            </tr>
                            <xsl:if test="$countCLE > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">CLE</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Clean</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countPROP > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">PROP</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Properties</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countDPS > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">DPS</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Deposit</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countQSHA > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">QSHA</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Quoted Shares</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countUNQSHA > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">UNQSHA</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Unquoted Shares</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countUNT > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">UNT</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Unit Trusts</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countOFA > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">OFA</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Other Financial</td>
                                </tr>
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption"></td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;&#160;&#160;Assets</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countMTV > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">MTV</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Motor Vehicles</td>
                                </tr>
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption"></td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;&#160;&#160;(Registered With JPJ)</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countOTV > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">OTV</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Other</td>
                                </tr>
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption"></td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;&#160;&#160;Vehicles/Carriers</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countCONC > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">CONC</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Concession And</td>
                                </tr>
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption"></td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;&#160;&#160;Other Contractual</td>
                                </tr>
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption"></td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;&#160;&#160;Rights</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countPAM > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">PAM</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Plat And Machinery</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countFG > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">FG</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Financial Guarantee</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countNP > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">NP</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Negative Pledge</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countSL > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">SL</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Supportive Letters</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countOAS > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">OAS</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Other Assets</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countSEC > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">SEC</td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">- Secured- Details</td>
                                </tr>
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption"></td>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;&#160;&#160;Unknown</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$largestNumber - $countCollateralType &gt; '0'">
                                <xsl:for-each select="(//node())[position() &lt;= ($largestNumber - $countCollateralType)]">
                                    <tr>
                                        <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;</td>
                                    </tr>
                                </xsl:for-each>
                            </xsl:if>
                        </table>
                    </td>
                    <td colspan="3" style="padding: 0px 0px 0px 6px; border-top: none;  border-left: none;  border-bottom: none; background-color: #DDDDDD;">
                        <table>
                            <xsl:if test="$countStatus > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption"><strong>Status</strong></td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countStatus = '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countStatusS > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">S - Fully Settled</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$countStatusW > '0'">
                                <tr>
                                    <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">W - Written Off Bad Debt</td>
                                </tr>
                            </xsl:if>
                            <xsl:if test="$largestNumber - $countStatus &gt; '0'">
                                <xsl:for-each select="(//node())[position() &lt;= ($largestNumber - $countStatus)]">
                                    <tr>
                                        <td class="caption" style="padding: 0px; font-size:7px; text-align: left; border: none;" nowrap="caption">&#160;</td>
                                    </tr>
                                </xsl:for-each>
                            </xsl:if>
                        </table>
                    </td>
                </tr>
	    	</xsl:when>
            <xsl:otherwise>
            	<td class="vertical-center">
                		No Information Available
                </td>
            </xsl:otherwise>
            </xsl:choose>
            <tr>
                <th width="2%" colspan="2" style="background-color: #DDDDDD; border-top: none; border-right: none;"></th>
                <th width="2%" colspan="12" style="background-color: #DDDDDD; border-top: none; border-right: none; border-left: none;"></th>
                <th width="2%" colspan="2" style="background-color: #DDDDDD; border-top: none; border-left: none;"></th>
            </tr>
        </table>
        <br/><br/>
    </xsl:template>
    <!-- finish etr_plus_payment_history_template -->
    
    <!-- start non_blank_lender_credit_information_template -->
    <xsl:template name="non_blank_lender_credit_information_template">
    
    	<xsl:variable name="currYear">
            <xsl:call-template name="getYearOnly_e">
                <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
            </xsl:call-template>
        </xsl:variable>
        
        <xsl:variable name="seq">
	    	<xsl:value-of select="@seq"/>
	    </xsl:variable>
        
        <table class="table-ccris">
            <tr>
                <td colspan="27" style="background-color: #666666; color:#FFFFFF; text-align: left; font-size:10.6px; padding-left: 2%; padding-top: 0.5%; padding-bottom: 0.5%">
                <strong>2. Non-Bank Lender Credit Information</strong> - Fixed Instalments (Last 12 months)</td>		
            </tr>
	    	<xsl:if test="//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory">
            <tr>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">No.</th>
                <th width="8%" style="background-color: #666666; color:#FFFFFF">Aprv date</th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">Capacity</th>
                <th width="6%" style="text-align: left; padding-left: 1%; background-color: #666666; color:#FFFFFF">Lender Type</th>
                <th width="5%" style="background-color: #666666; color:#FFFFFF">Facility</th>
                <th width="8%" style="background-color: #666666; color:#FFFFFF">Limit<br/>(RM)</th>
                <th width="8%" style="text-align: left; padding-left: 1%; background-color: #666666; color:#FFFFFF">Instalment Amount <br/> (RM) </th>
                <th width="8%" style="text-align: left; padding-left: 1%; background-color: #666666; color:#FFFFFF">Intalment Tenor<br/>(MTH)</th>
                <th width="8%" style="text-align: left; padding-left: 1%; background-color: #666666; color:#FFFFFF">Date<br/>Balance<br/>Updated</th>
                <th width="4%" style="text-align: left; background-color: #666666; color:#FFFFFF">Total Outstanding <br/>Balance<br/>(RM)</th>
                <th width="4%" style="text-align: left; background-color: #666666; color:#FFFFFF">Prin Repymt Term</th>
                <th width="4%" style="text-align: center; background-color: #666666; color:#FFFFFF">Col Type</th>
                <th width="24%" colspan="12" style="text-align: left; padding-left: 1%; background-color: #666666; color:#FFFFFF">Conduct Of Account For Last 12 Months</th>
                <th width="5%" style="background-color: #666666; color:#FFFFFF">Status</th>
                <th width="7%" style="text-align: left; background-color: #666666; color:#FFFFFF">Date<br/>Status<br/>Updated</th>
            </tr>
            <tr>
            	<th colspan="12" style="text-align: left; padding-left: 1%; padding-top: 2%; background-color: #666666; color:#FFFFFF" rowspan="2">OUTSTANDING CREDIT</th>
                <th width="12%" colspan="6" style="text-align: left; padding-left: 1%; border-right-width: 0; background-color: #666666; color:#FFFFFF">
                    <xsl:copy-of select="$currYear"/>
                </th>
                <th width="12%" colspan="6" style="text-align: right; padding-right: 1%; border-left-width: 0; background-color: #666666; color:#FFFFFF">
                    <xsl:copy-of select="$currYear - 1"/>
                </th>
                <th style="background-color: #666666; color:#FFFFFF" rowspan="2"></th>
                <th style="background-color: #666666; color:#FFFFFF" rowspan="2"></th>
            </tr>
            <tr>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">1</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">2</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">3</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">4</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">5</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">6</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">7</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">8</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">9</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">10</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">11</xsl:with-param>
                    </xsl:call-template>
                </th>
                <th width="2%" style="background-color: #666666; color:#FFFFFF">
                    <xsl:call-template name="getPastMonthFirstLetter">
                        <xsl:with-param name="datestr" select="ancestor::r:report/r:enq_report/r:header/r:enq_date"/>
                        <xsl:with-param name="past">12</xsl:with-param>
                    </xsl:call-template>
                </th>
            </tr>
			<tr>
				<xsl:for-each select="//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory">
		        	<tr>
		        		<td>
		        			<xsl:value-of select="r:number"/>
		        		</td>
		        		<td>
		        			<xsl:if test="r:approvalDate != ''">
		        				<xsl:variable name="dt" select="r:approvalDate"/>
									  <xsl:value-of select="concat(
									    substring($dt,9,2),'-',
									    substring($dt,6,2),'-',
									    substring($dt,1,4))" />
		        			</xsl:if>
		        		</td>
		        		<xsl:choose>
				        	<xsl:when test="r:capacity = 'P'">
								<td>
				        			P
				        		</td>
							</xsl:when>
							<xsl:when test="r:capacity = 'NP'">
								<td>
				        			NP
				        		</td>
							</xsl:when>
	                    </xsl:choose>
		        		<td>
		        			<xsl:value-of select="r:lenderType"/>
		        		</td>
		        		<td>
		        			<xsl:value-of select="r:facility"/>
		        		</td>
		        		<td>
		        			<xsl:if test="r:limit != ''">
		        				<xsl:call-template name="check_empty_number">
                            		<xsl:with-param name="number" select="r:limit"/>
                            	</xsl:call-template>
		        			</xsl:if>
		        		</td>
		        		<td>
		        			<xsl:if test="r:installmentAmount != ''">
		        				<xsl:call-template name="check_empty_number">
                            		<xsl:with-param name="number" select="r:installmentAmount"/>
                            	</xsl:call-template>
		        			</xsl:if>
		        		</td>
		        		<td>
		        			<xsl:value-of select="r:tenure"/>
		        		</td>
		        		<td>
		        			<xsl:if test="r:dateBalanceUpdated != ''">
		        				<xsl:variable name="dt" select="r:dateBalanceUpdated"/>
								 <xsl:value-of select="concat(
								    substring($dt,9,2),'-',
								    substring($dt,6,2),'-',
								    substring($dt,1,4))" />
		        			</xsl:if>
		        		</td>
		        		<td>
		        			<xsl:if test="r:totalOutStandingBalance != ''">
		        				<xsl:call-template name="check_empty_number">
                            		<xsl:with-param name="number" select="r:totalOutStandingBalance"/>
                            	</xsl:call-template>
		        			</xsl:if>
		        		</td>
		        		<td>
		        			<xsl:value-of select="r:principalRepaymentTerm"/>
		        		</td>
		        		<td>
		        			<xsl:value-of select="r:collateralType"/>
		        		</td>
		        		<xsl:variable name="countMonth">
							<xsl:value-of select="count(r:monthDetailsList/r:monthDetails)"/>
						</xsl:variable>
						<xsl:variable name="remainingMonth">
					        <xsl:value-of select="12 - $countMonth"/>
					    </xsl:variable>
		        		<xsl:for-each select="r:monthDetailsList/r:monthDetails">
	                    	<xsl:if test="$countMonth = '12'">
						    	<xsl:choose>
						        	<xsl:when test="(substring(r:payment,2) = '+') or r:payment &gt; '0' ">
										<td class="text-center" style="font-size:7px; background-color: #FE7676;">
											<xsl:value-of select="r:payment"/>
										</td>
									</xsl:when>
									<xsl:when test="r:payment = 'W' or r:payment = 'w'">
										<td class="text-center" style="font-size:7px; background-color: #FE7676;">
											<xsl:text>W</xsl:text>
										</td>
									</xsl:when>
									<xsl:when test="r:payment = 'S' or r:payment = 's'">
										<td class="text-center" style="font-size:7px; background-color: #A9D18E;">
											<xsl:text>S</xsl:text>
										</td>
									</xsl:when>
									<xsl:when test="contains(r:payment,'-') or r:payment = '0'">
										<td class="text-center" style="font-size:7px;">
											<xsl:value-of select="r:payment"/>
										</td>
									</xsl:when>
									<xsl:otherwise>
				                        <td style="background-color: #DDDDDD;">
										</td>
				                    </xsl:otherwise>
				            	</xsl:choose>
			            	</xsl:if>
			            	<xsl:if test="$countMonth &lt; '12'">
			                    	<xsl:variable name="i" select="position()">
					    			</xsl:variable>
			                    	<xsl:choose>
						        		<xsl:when test="(substring(r:payment,2) = '+') or r:payment &gt; '0' ">
											<td class="text-center" style="font-size:7px; background-color: #FE7676;">
												<xsl:value-of select="r:payment"/>
											</td>
										</xsl:when>
										<xsl:when test="r:payment = 'W' or r:payment = 'w'">
											<td class="text-center" style="font-size:7px; background-color: #FE7676;">
												<xsl:text>W</xsl:text>
											</td>
										</xsl:when>
										<xsl:when test="r:payment = 'S' or r:payment = 's'">
											<td class="text-center" style="font-size:7px; background-color: #A9D18E;">
												<xsl:text>S</xsl:text>
											</td>
										</xsl:when>
										<xsl:when test="contains(r:payment,'-') or r:payment = '0'">
											<td class="text-center" style="font-size:7px;">
												<xsl:value-of select="r:payment"/>
											</td>
										</xsl:when>
										<xsl:otherwise>
					                        <td style="background-color: #DDDDDD;">
											</td>
					                    </xsl:otherwise>
				                    </xsl:choose>
				                    <xsl:if test="12 - $remainingMonth = $i">
				                        <xsl:choose>
				                        	<xsl:when test="$remainingMonth = '1'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '2'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '3'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '4'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '5'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '6'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '7'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '8'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '9'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '10'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        	<xsl:when test="$remainingMonth = '11'">
				                        		<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
												<td style="background-color: #DDDDDD;">
												</td>
				                        	</xsl:when>
				                        </xsl:choose>
				                	</xsl:if>
			                    </xsl:if>
		        		</xsl:for-each>
		        		<td>
		        			<xsl:value-of select="r:status"/>
		        		</td>
		        		<td>
                            <xsl:if test="r:dateStatusUpdated != ''">
		        				<xsl:variable name="dt" select="r:dateStatusUpdated"/>
									  <xsl:value-of select="concat(
									    substring($dt,9,2),'-',
									    substring($dt,6,2),'-',
									    substring($dt,1,4))" />
		        			</xsl:if>
		        		</td>
		        	</tr>	
		        </xsl:for-each>
			</tr>
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
				<td>&#160;</td>
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
			<tr>
				<td></td>
				<td></td>
				<td></td>
				<td></td>
				<td>Total</td>
				<td><xsl:if test="//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:totalLimit != ''">
					<xsl:call-template name="check_empty_number">
                    	<xsl:with-param name="number" select="//r:enquiry/r:section_etr_plus/r:etrPlusNBLHistory/r:totalLimit"/>
                    </xsl:call-template>
					</xsl:if>
				</td>
				<td></td>
				<td></td>
				<td>Total</td>
				<td><xsl:if test="//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:overallTotalOutstandingBlance != ''">
					<xsl:call-template name="check_empty_number">
                    	<xsl:with-param name="number" select="//r:enquiry/r:section_etr_plus/r:etrPlusNBLHistory/r:overallTotalOutstandingBlance"/>
                    </xsl:call-template>
					</xsl:if>
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
			<tr>
			</tr>
			</xsl:if>
        </table>
        <xsl:choose>
	    <xsl:when test="//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory">
	    <!-- START COUNT CAPACITY -->
	    <xsl:variable name="countP">
	    	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:capacity[text() = 'P']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countNonP">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:capacity[text() = 'NP']) &gt; '0'">
        		<xsl:value-of select="3"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countCapacity">
        	<xsl:value-of select="$countP+$countNonP"></xsl:value-of>
        </xsl:variable>
        <!-- END COUNT CAPACITY -->
        <!-- START COUNT LENDER TYPE -->
        <xsl:variable name="countP2P">
	    	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:lenderType[text() = 'P2P']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countCRLS">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:lenderType[text() = 'CRLS']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countCOOP">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:lenderType[text() = 'COOP']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countBNPL">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:lenderType[text() = 'BNPL']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countRE">
            <xsl:choose>
                <xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:lenderType[text() = 'RE']) &gt; '0'">
                    <xsl:value-of select="1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="0"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="countLenderType">
        	<xsl:value-of select="$countP2P+$countCRLS+$countCOOP+$countBNPL+$countRE"></xsl:value-of>
        </xsl:variable>
        <!-- END COUNT LENDER TYPE -->
        <!-- START COUNT FACILITY -->
        <xsl:variable name="countTF">
	    	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:facility[text() = 'TF']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countGS">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:facility[text() = 'GS']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countTL">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:facility[text() = 'TL']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countALR">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:facility[text() = 'ALR']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countCR">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:facility[text() = 'CR']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countDLR">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:facility[text() = 'DLR']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countIR">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:facility[text() = 'IR']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countISM">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:facility[text() = 'ISM']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countRR">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:facility[text() = 'RR']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countFacility">
        	<xsl:value-of select="$countTF+$countGS+$countTL+$countALR+$countCR+$countDLR+$countIR+$countISM+$countRR"></xsl:value-of>
        </xsl:variable>
        <!-- END COUNT FACILITY -->
        <!-- START COUNT REPAYMENT TERM -->
        <xsl:variable name="countMTH">
	    	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:principalRepaymentTerm[text() = 'MTH']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countQTR">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:principalRepaymentTerm[text() = 'QTR']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countHY">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:principalRepaymentTerm[text() = 'HY']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countA">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:principalRepaymentTerm[text() = 'A']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countB">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:principalRepaymentTerm[text() = 'B']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countRepaymentTerm">
        	<xsl:value-of select="$countMTH+$countQTR+$countHY+$countA+$countB"></xsl:value-of>
        </xsl:variable>
        <!-- END COUNT REPAYMENT TERM -->
        <!-- START COUNT COLLATERAL TYPE -->
        <xsl:variable name="countCLE">
	    	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'CLE']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countPROP">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'PROP']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countDPS">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'DPS']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countQSHA">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'QSHA']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countUNQSHA">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'UNQSHA']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countUNT">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'UNT']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countOFA">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'OFA']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countMTV">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'MTV']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countOTV">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'OTV']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countCONC">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'CONC']) &gt; '0'">
        		<xsl:value-of select="3"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countPAM">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'PAM']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countFG">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'FG']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countNP">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'NP']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countSL">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'SL']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countOAS">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'OAS']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countSEC">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:collateralType[text() = 'SEC']) &gt; '0'">
        		<xsl:value-of select="2"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countCollateralType">
        	<xsl:value-of select="$countCLE+$countPROP+$countDPS+$countQSHA+$countUNQSHA
        	+$countUNT+$countOFA+$countMTV+$countOTV+$countCONC+$countPAM
        	+$countFG+$countNP+$countSL+$countOAS+$countSEC"></xsl:value-of>
        </xsl:variable>
        <!-- END COUNT COLLATERAL TYPE -->
        <!-- START COUNT STATUS -->
        <xsl:variable name="countLEGAL">
	    	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:status[text() = 'LEGAL']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countNPL">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:status[text() = 'NPL']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countS">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:monthDetailsList/r:monthDetails/r:payment[text() = 's']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countW">
        	<xsl:choose>
        	<xsl:when test="count(//r:enquiry[@seq = $seq]/r:section_etr_plus/r:etrPlusNBLHistory/r:etrPlusNBLCreditHistoryList/r:etrPlusNBLCreditHistory/r:monthDetailsList/r:monthDetails/r:payment[text() = 'w']) &gt; '0'">
        		<xsl:value-of select="1"/>
        	</xsl:when>
        	<xsl:otherwise>
        		<xsl:value-of select="0"/>
        	</xsl:otherwise>
        	</xsl:choose>
        </xsl:variable>
        <xsl:variable name="countStatus">
        	<xsl:value-of select="$countLEGAL+$countNPL+$countS+$countW"></xsl:value-of>
        </xsl:variable>
        <!-- END COUNT STATUS -->
        <!-- <xsl:sort select="$countCapacity,$countLenderType,$countFacility,$countRepaymentTerm,$countCollateralType,$countStatus"/> -->
        <xsl:variable name="largestNumber">
        <xsl:choose>
	        <xsl:when test="$countCapacity &gt;= $countLenderType and $countCapacity &gt;= $countFacility
	        				and $countCapacity &gt;= $countRepaymentTerm and $countCapacity &gt;= $countCollateralType 
	        				and $countCapacity &gt;= $countStatus">
	        <xsl:value-of select="$countCapacity"></xsl:value-of>
	        </xsl:when>
	        <xsl:when test="$countLenderType &gt;= $countCapacity and $countLenderType &gt;= $countFacility
	        				and $countLenderType &gt;= $countRepaymentTerm and $countLenderType &gt;= $countCollateralType 
	        				and $countLenderType &gt;= $countStatus">
	        <xsl:value-of select="$countLenderType"></xsl:value-of>
	        </xsl:when>
	        <xsl:when test="$countFacility &gt;= $countCapacity and $countFacility &gt;= $countLenderType
	        				and $countFacility &gt;= $countRepaymentTerm and $countFacility &gt;= $countCollateralType 
	        				and $countFacility &gt;= $countStatus">
	        <xsl:value-of select="$countFacility"></xsl:value-of>
	        </xsl:when>
	        <xsl:when test="$countRepaymentTerm &gt;= $countCapacity and $countRepaymentTerm &gt;= $countLenderType
	        				and $countRepaymentTerm &gt;= $countFacility and $countRepaymentTerm &gt;= $countCollateralType 
	        				and $countRepaymentTerm &gt;= $countStatus">
	        <xsl:value-of select="$countRepaymentTerm"></xsl:value-of>
	        </xsl:when>
	        <xsl:when test="$countCollateralType &gt;= $countCapacity and $countCollateralType &gt;= $countLenderType
	        				and $countCollateralType &gt;= $countFacility and $countCollateralType &gt;= $countRepaymentTerm 
	        				and $countCollateralType &gt;= $countStatus">
	        <xsl:value-of select="$countCollateralType"></xsl:value-of>
	        </xsl:when>
	        <xsl:when test="$countStatus &gt;= $countCapacity and $countStatus &gt;= $countLenderType
	        				and $countStatus &gt;= $countFacility and $countStatus &gt;= $countRepaymentTerm 
	        				and $countStatus &gt;= $countCollateralType">
	        <xsl:value-of select="$countStatus"></xsl:value-of>
	        </xsl:when>
        </xsl:choose>
        </xsl:variable>
	    <table class="table-ccris">
       		<tr>
                <th width="2%" nowrap="Remark Legend:" style="text-align: left; padding-left: 1%; padding-top: 1%; border-bottom: none;" colspan="12"><strong>Remark Legend:</strong></th>
            </tr>
            <!-- <tr>
            	<th colspan="2" nowrap="CAPACITY" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-right: none; border-bottom: none;"><strong>CAPACITY</strong></th>
            	<th colspan="2" nowrap="LENDER TYPE" style="text-align: left; padding-left: 2%; padding-top: 1%; border-top: none; border-right: none; border-left: none; border-bottom: none;"><strong>LENDER TYPE</strong></th>
            	<th colspan="2" style="text-align: left; padding-left: 2%; padding-top: 1%; border-top: none; border-right: none; border-left: none; border-bottom: none;"><strong>FACILITY</strong></th>
            	<th colspan="2" nowrap="REPAYMENT TERM" style="text-align: left; padding-left: 4.5%; padding-top: 1%; border-top: none; border-right: none; border-left: none; border-bottom: none;"><strong>REPAYMENT TERM</strong></th>
            	<th colspan="2" nowrap="COLLATERAL TYPE" style="text-align: left; padding-left: 2.2%; padding-top: 1%; border-top: none; border-right: none; border-left: none; border-bottom: none;"><strong>COLLATERAL TYPE</strong></th>
            	<th colspan="2" nowrap="COLLATERAL TYPE" style="text-align: left; padding-top: 1%; border-top: none; border-left: none; border-bottom: none;"><strong>STATUS&#160;&#160;&#160;&#160;&#160;&#160;
            	&#160;&#160;&#160;&#160;</strong></th>
            </tr> -->
            <tr>
            	<th colspan="2" width="2%" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-right: none; border-bottom: none;"></th>
            	<th colspan="2" width="2%" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-right: none; border-left: none; border-bottom: none;"></th>
            	<th colspan="2" width="2%" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-right: none; border-left: none; border-bottom: none;"></th>
            	<th colspan="2" width="2%" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-right: none; border-left: none; border-bottom: none;"></th>
            	<th colspan="2" width="2%" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-right: none; border-left: none; border-bottom: none;"></th>
            	<th colspan="2" width="2%" style="text-align: left; padding-left: 1%; padding-top: 1%; border-top: none; border-left: none; border-bottom: none;"></th>
            </tr>
            <!-- START CAPACITY -->
	        <table class="table-remark-legend">
	        <tr>
	        	<th colspan="2" style="text-align: left; padding-left: 6%; padding-bottom: 7.5%; border-top: none; border-right: none; border-bottom: none;"><strong>CAPACITY</strong></th>
	        </tr>
            <xsl:if test="$countP &gt; '0'">
				<tr>
					<td width="2%" style="padding-left: 6%; border-top: none; border-right: none; border-bottom: none;">P</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Personal&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countNonP &gt; '0'">
				<tr>
					<td width="2%" style="padding-left: 6%; border-top: none; border-right: none; border-bottom: none;">NP</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Non-Personal&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-bottom: none;"></td>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;(Guarantor or</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-bottom: none;"></td>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;Joint Owner)</td>
				</tr>
			</xsl:if>
			<xsl:if test="$largestNumber - $countCapacity &gt; '0'">
			<xsl:for-each select="(//node())[position() &lt;= ($largestNumber - $countCapacity)]">
				<tr>
					<td width="2%" style="padding-left: 6%; color: #DDDDDD; border-top: none; border-right: none; border-bottom: none;">&#160;</td>
	            	<td width="2%" style="padding-left: 6%; color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
				</tr>
			</xsl:for-each>
			</xsl:if>
			</table>
			<!-- END CAPACITY -->
			<!-- START LENDER TYPE -->
			<table class="table-remark-legend">
			<tr>
	        	<th colspan="2" style="text-align: left; padding-bottom: 7.5%; border-top: none; border-right: none; border-bottom: none; border-left: none;"><strong>LENDER TYPE</strong></th>
	        </tr>
			<xsl:if test="$countP2P &gt; '0'">
	       		<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">P2P</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- P2P Lender&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countCRLS &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">CRLS</td>
	            	<td width="2%" nowrap="CREDIT" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Credit &amp; Leasing&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countCOOP &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">COOP</td>
	            	<td width="2%" nowrap="Koperasi" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Koperasi / Co-&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;operative</td>
				</tr>
			</xsl:if>
            <xsl:if test="$countBNPL &gt; '0'">
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">BNPL</td>
                    <td width="2%" nowrap="Koperasi" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Buy Now Pay Later&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
                </tr>
            </xsl:if>
            <xsl:if test="$countRE &gt; '0'">
                    <tr>
                        <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">RE</td>
                        <td width="2%" nowrap="Koperasi" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Real Estate&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
                    </tr>
                </xsl:if>
			<xsl:if test="$largestNumber - $countLenderType &gt; '0'">
			<xsl:for-each select="(//node())[position() &lt;= ($largestNumber - $countLenderType)]">
				<tr>
					<td width="2%" style="color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
	            	<td width="2%" style="color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
				</tr>
			</xsl:for-each>
			</xsl:if>
			</table>
			<!-- END LENDER TYPE -->
			<!-- START FACILITY -->
			<table class="table-remark-legend">
			<tr>
	        	<th colspan="2" style="text-align: left; padding-bottom: 7.5%; border-top: none; border-right: none; border-bottom: none; border-left: none;"><strong>FACILITY</strong></th>
	        </tr>
			<xsl:if test="$countTF &gt; '0'">
	       		<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">TF</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Trade Facilities&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countGS &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">GS</td>
	            	<td width="2%" nowrap="Good" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Goods &amp; Services&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Rendered</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countTL &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">TL</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Term Loan&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Operative</td>
				</tr>
			</xsl:if>
            <xsl:if test="$countALR &gt; '0'">
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">ALR</td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Agriculture&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
                </tr>
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Land Rental</td>
                </tr>
            </xsl:if>
            <xsl:if test="$countCR &gt; '0'">
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">CR</td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Commercial&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
                </tr>
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Rental</td>
                </tr>
            </xsl:if>
            <xsl:if test="$countDLR &gt; '0'">
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">DLR</td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Development&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
                </tr>
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Land Rental</td>
                </tr>
            </xsl:if>
            <xsl:if test="$countIR &gt; '0'">
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">IR</td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Industrial&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
                </tr>
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Rental</td>
                </tr>
            </xsl:if>
            <xsl:if test="$countISM &gt; '0'">
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">ISM</td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Instalment&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
                </tr>
            </xsl:if>
            <xsl:if test="$countRR &gt; '0'">
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">RR</td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Residential&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
                </tr>
                <tr>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
                    <td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Rental</td>
                </tr>
            </xsl:if>
			<xsl:if test="$largestNumber - $countFacility &gt; '0'">
			<xsl:for-each select="(//node())[position() &lt;= ($largestNumber - $countFacility)]">
				<tr>
					<td width="2%" style="color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
	            	<td width="2%" style="color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
				</tr>
			</xsl:for-each>
			</xsl:if>
			</table>
			<!-- END FACILITY -->
			<!-- START REPAYMENT TERM -->
			<table class="table-remark-legend">
			<tr>
	        	<th colspan="2" style="text-align: left; padding-bottom: 7.5%; border-top: none; border-right: none; border-bottom: none; border-left: none;"><strong>REPAYMENT TERM</strong></th>
	        </tr>
			<xsl:if test="$countMTH &gt; '0'">
	       		<tr>
					<td width="2%" style="padding-left: -7%; border-top: none; border-right: none; border-left: none; border-bottom: none;">MTH</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Monthly&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countQTR &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">QTR</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Quarterly&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countHY &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">HY</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Half Yearly&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countA &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">A</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Annualy&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countB &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">B</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Bullet&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$largestNumber - $countRepaymentTerm &gt; '0'">
			<xsl:for-each select="(//node())[position() &lt;= ($largestNumber - $countRepaymentTerm)]">
				<tr>
					<td width="2%" style="color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
	            	<td width="2%" style="color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
				</tr>
			</xsl:for-each>
			</xsl:if>
			</table>
			<!-- END REPAYMENT TERM -->
			<!-- START COLLATERAL TYPE -->
			<table class="table-remark-legend">
			<tr>
	        	<th colspan="2" style="text-align: left; padding-bottom: 7.5%; border-top: none; border-right: none; border-bottom: none; border-left: none;"><strong>COLLATERAL TYPE</strong></th>
	        </tr>
			<xsl:if test="$countCLE &gt; '0'">
	       		<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">CLE</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Clean</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countPROP &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">PROP</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Properties</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countDPS &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">DPS</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Deposit</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countQSHA &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">QSHA</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Quoted Shares</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countUNQSHA &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">UNIQSHA</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Unquoted Shares</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countUNT &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">UNT</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Unit Trusts</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countOFA &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">OFA</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Other Financial</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Assets</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countMTV &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">MTV</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Motor Vehicles</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;" nowrap="Registed">&#160;&#160;&#160;(Registered With JPJ)</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countOTV &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">OTV</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Other</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;" nowrap="Registed">&#160;&#160;&#160;Vehicles/Carriers</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countCONC &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">CONC</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">- Concession And</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;" nowrap="Registed">&#160;&#160;&#160;Other Contractual</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Rights</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countPAM &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">PAM</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;" nowrap="Plat">- Plat And Machinery</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countFG &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">FG</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;" nowrap="Financial">- Financial Guarantee</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countNP &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">NP</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;" nowrap="Negative">- Negative Pledge</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countSL &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">SL</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;" nowrap="Supportive">- Supportive Letters</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countOAS &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">OAS</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;" nowrap="Other">- Other Assets</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countSEC &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">SEC</td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;" nowrap="Secured">- Secured- Details</td>
				</tr>
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;"></td>
	            	<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;&#160;&#160;Unknown</td>
				</tr>
			</xsl:if>
			<xsl:if test="$largestNumber - $countCollateralType &gt; '0'">
			<xsl:for-each select="(//node())[position() &lt;= ($largestNumber - $countCollateralType)]">
				<tr>
					<td width="2%" style="color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
	            	<td width="2%" style="color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
				</tr>
			</xsl:for-each>
			</xsl:if>
			</table>
			<!-- END COLLATERAL TYPE -->
			<!-- START STATUS -->
			<table class="table-remark-legend" style="width: 20%">
			<tr>
	        	<th colspan="2" style="text-align: left; padding-bottom: 6%; border-top: none; border-bottom: none; border-left: none;"><strong>STATUS</strong></th>
	        </tr>
			<xsl:if test="$countLEGAL &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">LEGAL</td>
	            	<td width="2%" style="border-top: none; border-left: none; border-bottom: none;" nowrap="Legal">- Legal Letter Sent&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countNPL &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">NPL</td>
	            	<td width="2%" style="border-top: none; border-left: none; border-bottom: none;" nowrap="Legal">- Non-Performing Loan&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countS &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">S</td>
	            	<td width="2%" style="border-top: none; border-left: none; border-bottom: none;" nowrap="Legal">- Fully Settled&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$countW &gt; '0'">
				<tr>
					<td width="2%" style="border-top: none; border-right: none; border-left: none; border-bottom: none;">W</td>
	            	<td width="2%" style="border-top: none; border-left: none; border-bottom: none;" nowrap="Legal">- Written Off Bad Debt&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;</td>
				</tr>
			</xsl:if>
			<xsl:if test="$largestNumber - $countStatus &gt; '0'">
			<xsl:for-each select="(//node())[position() &lt;= ($largestNumber - $countStatus)]">
				<tr>
					<td width="2%" style="color: #DDDDDD; border-top: none; border-right: none; border-left: none; border-bottom: none;">&#160;</td>
	            	<td width="2%" style="color: #DDDDDD; border-top: none; border-left: none; border-bottom: none;">&#160;</td>
				</tr>
			</xsl:for-each>
			</xsl:if>
			</table>
			<!-- END STATUS -->
		</table>
		<table class="table-ccris">
			<tr>
            	<th width="2%" colspan="2" style="background-color: #DDDDDD; border-top: none; border-right: none;"></th>
            	<th width="2%" colspan="2" style="background-color: #DDDDDD; border-top: none; border-right: none; border-left: none;"></th>
            	<th width="2%" colspan="2" style="background-color: #DDDDDD; border-top: none; border-right: none; border-left: none;"></th>
            	<th width="2%" colspan="2" style="background-color: #DDDDDD; border-top: none; border-right: none; border-left: none;"></th>
            	<th width="2%" colspan="2" style="background-color: #DDDDDD; border-top: none; border-right: none; border-left: none;"></th>
            	<th width="2%" colspan="2" style="background-color: #DDDDDD; border-top: none; border-left: none;"></th>
            </tr>
		</table>
		</xsl:when>
		<xsl:otherwise>
             <p class="info">No Information Available</p>
        </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    <!-- finish non_blank_lender_credit_information_template -->
    
    <!-- start getYearOnly_e -->
    <xsl:template name="getYearOnly_e">
        <xsl:param name="datestr"/>
        <xsl:variable name="yyyy">
            <xsl:value-of select="substring($datestr,1,4)"/>
        </xsl:variable>
        <xsl:value-of select="$yyyy"/>
    </xsl:template>
    <!-- fnish getYearOnly_e -->
    
    <!-- start getPastMonthAndYearOnly_section_e -->
    <xsl:template name="getPastMonthAndYearOnly_section_e">
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
                <xsl:variable name="yyyy">
            <xsl:value-of select="substring($datestr,1,4)"/>
        </xsl:variable>
        <xsl:variable name="mthyyyy">
            <xsl:choose> 
                <xsl:when test="($currMth - $past) &lt;= 0">
                    <xsl:value-of select="$yyyy - 1"/>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:value-of select="$yyyy"/>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:if test="$month = 1">
            <xsl:text>Jan&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 2">
            <xsl:text>Feb&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 3">
            <xsl:text>Mar&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 4">
            <xsl:text>Apr&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 5">
            <xsl:text>May&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 6">
            <xsl:text>Jun&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 7">
            <xsl:text>Jul&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 8">
            <xsl:text>Aug&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 9">
            <xsl:text>Sep&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 10">
            <xsl:text>Oct&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 11">
            <xsl:text>Nov&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>
        <xsl:if test="$month = 12">
            <xsl:text>Dec&#xa;</xsl:text>
            <xsl:value-of select="$mthyyyy"/>
        </xsl:if>	
    </xsl:template>
    <!-- finish getPastMonthAndYearOnly_section_e -->
    
</xsl:stylesheet>
