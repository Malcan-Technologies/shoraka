<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/response"
                exclude-result-prefixes="xsl r">
    
    <xsl:template name="section_d1_template">
        
        <p class="title">
            D1: LEGAL CASES (SUBJECT AS DEFENDANT)
        </p>
        
        <xsl:if test="r:section_d[@data = 'true']">
            
            <!-- special case -->
            <xsl:for-each select="r:section_d/r:record">
            
                <xsl:call-template name="section_d1_C1_template"/>
                <xsl:call-template name="section_d1_C2_template"/>
                <xsl:call-template name="section_d1_C4_template"/>
                <xsl:call-template name="section_d1_C5_template"/>
                <xsl:call-template name="section_d1_C6_template"/>
                <xsl:call-template name="section_d1_C7_template"/>
                <xsl:call-template name="section_d1_C8_template"/>
                <xsl:call-template name="section_d1_C9_template"/>
                <xsl:call-template name="section_d1_CA_template"/>
                <xsl:call-template name="section_d1_CC_template"/>
                <xsl:call-template name="section_d1_CD_template"/>
                <xsl:call-template name="section_d1_CF_template"/>
            
                <xsl:call-template name="section_d1_I1_template"/>
                <xsl:call-template name="section_d1_I2_template"/>
                <xsl:call-template name="section_d1_I4_template"/>
                <xsl:call-template name="section_d1_I5_template"/>
                <xsl:call-template name="section_d1_I6_template"/>
                <xsl:call-template name="section_d1_I7_template"/>
                <xsl:call-template name="section_d1_I8_template"/>
                <xsl:call-template name="section_d1_I9_template"/>
                <xsl:call-template name="section_d1_ID_template"/>
                
                <xsl:call-template name="section_d1_X4_template"/>
                
            </xsl:for-each>
        
        </xsl:if>
        
        <xsl:if test="r:section_d[@data = 'false']">
            
            <p class="info">No Information Available</p>
            
            <br/>
            
        </xsl:if>

    </xsl:template>

    <xsl:template name="section_d2_template">

        <p class="title">
            D2: LEGAL CASES (SUBJECT AS PLAINTIFF)
        </p>
        
        <xsl:if test="r:section_d2[@data = 'true']">
            
            <xsl:for-each select="r:section_d2/r:record">
            
                <xsl:call-template name="section_d2_C1_template"/>
                <xsl:call-template name="section_d2_C2_template"/>
                <xsl:call-template name="section_d2_I2_template"/>
                
            </xsl:for-each>
        
        </xsl:if>
        
        <xsl:if test="r:section_d2[@data = 'false']">
            
            <p class="info">No Information Available</p>
            
            <br/>
            
        </xsl:if>

    </xsl:template>

    <xsl:template name="section_d3_template">
        
        <p class="title">
            D3: AMLA (ANTI MONEY LAUNDERING ACT)
        </p>

        <xsl:if test="r:section_b[@data = 'true']">
                
            <xsl:for-each select="r:section_b/r:record">
                   
                <xsl:call-template name="section_d3_Sn_template"/>
                <xsl:call-template name="section_d3_Un_template"/>
                    
            </xsl:for-each>

        </xsl:if>
        
        <xsl:variable name="count">
            <xsl:value-of select="count(r:section_b[@data = 'true']/r:record[@rpttype = 'Sn']) + count(r:section_b[@data = 'true']/r:record[@rpttype = 'Un'])"/>
        </xsl:variable>
        
        <xsl:if test="r:section_b[@data = 'false'] or $count = '0'">
            
            <p class="info">No Information Available</p>
            
            <br/>
            
        </xsl:if>

    </xsl:template>
    
    <xsl:template name="section_d4_template">
        
        <xsl:if test="r:section_d4">
        
            <p class="title">
                D4: LEGAL CASES (NON PERSONAL CAPACITY)
            </p>

            <xsl:if test="r:section_d4[@data = 'true']">
                
                <xsl:for-each select="r:section_d4/r:record">
                   
                    <xsl:call-template name="section_d4_legal_cases_template"/>
                    
                </xsl:for-each>

            </xsl:if>
        
            <xsl:if test="r:section_d4[@data = 'false']">
            
                <p class="info">No Information Available</p>
            
                <br/>
            
            </xsl:if>

        </xsl:if>

    </xsl:template>
    
    <!-- start section_d1_summary -->
    <xsl:template name="section_d1_summary_template">

        <xsl:if test="r:section_d[@data = 'true']">
            
            <p class="title">
                D1: LEGAL CASES (SUBJECT AS DEFENDANT)
            </p>        
        
            <p class="header">
                SUMMARY
            </p>
                
            <table class="table">
                <tr>
                    <td class="caption text-center bold">No.</td>
                    <td class="caption text-center bold">Case Type</td>
                    <td class="caption text-center bold">Amount</td>
                    <td class="caption text-center bold">Plaintiff</td>
                    <td class="caption text-center bold">Status</td>
                    <td class="caption text-center bold">Subject<br/>Comments</td>
                </tr>
                <xsl:for-each select="r:section_d/r:record">
                    <xsl:if test="@rpttype != 'X4'">
                        <tr>
                            <td class="text-center">
                                <xsl:value-of select="@seq"/>.
                            </td>
                            <td class="text-left">
                                <xsl:if test="@rpttype = 'CD'">
                                    SECTION 308 POWER OF REGISTRAR TO STRIKE OFF DEFUNCT COMPANY FROM REGISTER
                                </xsl:if>
                                <xsl:if test="@rpttype = 'CF'">
                                    COMPANY UNDER SPECIAL ADMINISTRATION (PAST &amp; CURRENT)
                                </xsl:if>
                                <xsl:if test="@rpttype != 'CD' and @rpttype != 'CF' and @rpttype != 'X4'">
                                    <xsl:value-of select="r:title"/>
                                </xsl:if>
                            </td>
                            <td class="text-right">
                                <xsl:if test="r:amount">
                                    <xsl:call-template name="check_empty_number">
                                        <xsl:with-param name="number" select="r:amount"/>
                                    </xsl:call-template>
                                </xsl:if>
                                <xsl:if test="not(r:amount)">
                                    <xsl:if test="r:reserve_price">
                                        <xsl:call-template name="check_empty_number">
                                            <xsl:with-param name="number" select="r:reserve_price"/>
                                        </xsl:call-template>
                                    </xsl:if>
                                    <xsl:if test="not(r:reserve_price)">
                                        <xsl:if test="r:outstanding_amount">
                                            <xsl:call-template name="check_empty_number">
                                                <xsl:with-param name="number" select="r:outstanding_amount"/>
                                            </xsl:call-template>
                                        </xsl:if>
                                        <xsl:if test="not(r:outstanding_amount)">
                                            -
                                        </xsl:if>
                                    </xsl:if>
                                </xsl:if>
                            </td>
                            <td class="text-center">
                                <xsl:if test="r:exparte">
                                    <xsl:value-of select="r:exparte"/>
                                </xsl:if>
                                <xsl:if test="not(r:exparte)">
                                    <xsl:if test="r:plaintiff">
                                        <xsl:value-of select="r:plaintiff"/>
                                    </xsl:if>
                                    <xsl:if test="not(r:plaintiff)">
                                        <xsl:if test="r:petitioner">
                                            <xsl:value-of select="r:petitioner"/>
                                        </xsl:if>
                                        <xsl:if test="not(r:petitioner)">
                                            <xsl:if test="r:assignee">
                                                <xsl:value-of select="r:assignee"/>
                                            </xsl:if>
                                            <xsl:if test="not(r:assignee)">
                                                <xsl:if test="r:chargee">
                                                    <xsl:value-of select="r:chargee"/>
                                                </xsl:if>
                                                <xsl:if test="not(r:chargee)">
                                                    <xsl:if test="r:applicant">
                                                        <xsl:value-of select="r:applicant"/>
                                                    </xsl:if>
                                                    <xsl:if test="not(r:applicant)">
                                                        -
                                                    </xsl:if>
                                                </xsl:if>
                                            </xsl:if>
                                        </xsl:if>
                                    </xsl:if>
                                </xsl:if>
                            </td>
                            <td class="text-center">
                                <xsl:if test="r:settlement/r:code">
                                    <xsl:value-of select="r:settlement/r:code"/>
                                </xsl:if>
                                <xsl:if test="not(r:settlement/r:code)">
                                    <xsl:if test="r:latest_status/r:code">
                                        <xsl:value-of select="r:latest_status/r:code"/>
                                    </xsl:if>
                                    <xsl:if test="not(r:latest_status/r:code)">
                                        <xsl:if test="r:withheld/r:message">
                                            <xsl:value-of select="r:withheld/r:message"/>
                                        </xsl:if>
                                        <xsl:if test="not(r:withheld/r:message)">
                                            -
                                        </xsl:if>
                                    </xsl:if>
                                </xsl:if>
                            </td>
                            <td class="text-center">
                                <xsl:if test="r:latest_status/r:code">
                                    Y
                                </xsl:if>
                                <xsl:if test="not(r:latest_status/r:code)">
                                    N
                                </xsl:if>
                            </td>
                        </tr>
                    </xsl:if>
                </xsl:for-each>
            </table>
            
            <xsl:for-each select="r:section_d/r:record">
                <xsl:if test="@rpttype = 'X4'">
                    <p class="notice">
                        <xsl:value-of select="r:withheld/r:message"/>
                    </p>
                </xsl:if>
            </xsl:for-each>
            
            <br/>
        </xsl:if>
    </xsl:template>
    <!-- finish section_d1_summary -->
    
    <!-- start section_d1_C1 -->
    <xsl:template name="section_d1_C1_template">
        
        <xsl:if test="@rpttype = 'C1'">
           
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Respondent</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Object</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:object"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Incorporation Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:incoporate_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Last Annual Return Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:return_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Authorised Capital</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number_no_zero">
                            <xsl:with-param name="number" select="r:capital"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Paid-Up Capital</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number_no_zero">
                            <xsl:with-param name="number" select="r:paidup"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Petitioner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:petitioner"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="long-content"  colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <!--
<th class="caption">Court</th>
<td class="short-content">
    <xsl:call-template name="check_empty_string">
        <xsl:with-param name="value" select="r:court_detail"/>
    </xsl:call-template>
</td>
                    -->
                </tr>
                <tr>
                    <th class="caption">Petition Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:petition) or r:petition = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:petition and r:petition != ''">
                            <xsl:for-each select="r:petition">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_petition"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:order) or r:order = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:order and r:order != ''">
                            <xsl:for-each select="r:order">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_order"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">CCM Search Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:cpo_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:remark1, ' ', r:remark2, ' ', r:remark3, ' ', r:remark4)"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_liquidator_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_director_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_C1 -->

    <!-- start section_d1_C2 -->
    <xsl:template name="section_d1_C2_template">
        
        <xsl:if test="@rpttype = 'C2'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>

            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Plaintiff</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:plaintiff"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Action Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="not(r:action) or r:action = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:action and r:action != ''">
                            <xsl:for-each select="r:action">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Hearing Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:remark1, ' ', r:remark2, ' ', r:remark3, ' ', r:remark4)"/>
                        </xsl:call-template>                        
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_C2 -->

    <!-- start section_d1_C4 -->
    <xsl:template name="section_d1_C4_template">
        
        <xsl:if test="@rpttype = 'C4'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Action Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:action) or r:action = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:action and r:action != ''">
                            <xsl:for-each select="r:action">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                        
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_petition"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:remark1, ' ', r:remark2, ' ', r:remark3, ' ', r:remark4)"/>
                        </xsl:call-template>                        
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_liquidator_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_C4 -->

    <!-- start section_d1_C5 -->
    <xsl:template name="section_d1_C5_template">
        
        <xsl:if test="@rpttype = 'C5'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Action Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="not(r:action) or r:action = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:action and r:action != ''">
                            <xsl:for-each select="r:action">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                </tr>              
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:remark1, ' ', r:remark2, ' ', r:remark3, ' ', r:remark4)"/>
                        </xsl:call-template>                        
                    </td>
                </tr>
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_liquidator_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_C5 -->

    <!-- start section_d1_C6 -->
    <xsl:template name="section_d1_C6_template">
        
        <xsl:if test="@rpttype = 'C6'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
            
            <table class="table">
            
                <xsl:call-template name="section_d1_current_status_template"/>
                            
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Assignee</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:assignee"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Loan Aggrement/<br/>Assignment</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:assignment_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Auction Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:auction) or r:auction = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:auction and r:auction != ''">
                            <xsl:for-each select="r:auction">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Reserve Price</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:reserve_price"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark1"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_C6 -->

    <!-- start section_d1_C7 -->
    <xsl:template name="section_d1_C7_template">
        
        <xsl:if test="@rpttype = 'C7'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Chargee</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:chargee"/>
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:chargee"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Originating Summons Dated</th>
                    <td class="short-content">
                        <xsl:if test="not(r:originating_summons) or r:originating_summons = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:originating_summons and r:originating_summons != ''">
                            <xsl:for-each select="r:originating_summons">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Hearing Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order For Sale Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:order_for_sale_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Auction Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="not(r:auction) or r:auction = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:auction and r:auction != ''">
                            <xsl:for-each select="r:auction">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Reserve Price</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:reserve_price"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark1"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_C7 -->
 
    <!-- start section_d1_C8 -->
    <xsl:template name="section_d1_C8_template">
        
        <xsl:if test="@rpttype = 'C8'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Chargee</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:chargee"/>
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:chargee"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Notice Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:notice) or r:notice = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:notice and r:notice != ''">
                            <xsl:for-each select="r:notice">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order For Sale Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:order_for_sale_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Auction Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:auction) or r:auction = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:auction and r:auction != ''">
                            <xsl:for-each select="r:auction">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Outstanding Amount</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:outstanding_amount"/>
                        </xsl:call-template>                        
                    </td>
                    
                    <th class="caption">Reserve Price</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:reserve_price"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark1"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_C8 -->

    <!-- start section_d1_C9 -->
    <xsl:template name="section_d1_C9_template">
        
        <xsl:if test="@rpttype = 'C9'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Chargee</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:chargee"/>
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:chargee"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Notice Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:notice) or r:notice = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:notice and r:notice != ''">
                            <xsl:for-each select="r:notice">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Outstanding Amount</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:outstanding_amount"/>
                        </xsl:call-template>                        
                    </td>
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark1"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_liquidator_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_C9 -->

    <!-- start section_d1_CA -->
    <xsl:template name="section_d1_CA_template">
        
        <xsl:if test="@rpttype = 'CA'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Plaintiff</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:plaintiff"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Outstanding Amount</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:outstanding_amount"/>
                        </xsl:call-template>                        
                    </td>
                    
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order For Sale Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:order_for_sale_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Reserve Price</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:reserve_price"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Auction Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:auction) or r:auction = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:auction and r:auction != ''">
                            <xsl:for-each select="r:auction">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark1"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_CA -->

    <!-- start section_d1_CC -->
    <xsl:template name="section_d1_CC_template">
        
        <xsl:if test="@rpttype = 'CC'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Applicant</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:applicant"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="not(r:order) or r:order = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:order and r:order != ''">
                            <xsl:for-each select="r:order">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Hearing Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:remark1, ' ', r:remark2, ' ', r:remark3, ' ', r:remark4)"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>
                
            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_CC -->

    <!-- start section_d1_CD -->
    <xsl:template name="section_d1_CD_template">
        
        <xsl:if test="@rpttype = 'CD'">
            
            <p class="title">
                <xsl:value-of select="@seq"/>. SECTION 308 POWER OF REGISTRAR TO STRIKE OFF DEFUNCT COMPANY FROM REGISTER
            </p>
            
            <p class="notice">The CCM will strike-off from the register and dissolve a company.
                <br/>It believes is no longer carrying on business or in operations or is defunct. The following notification have been gazetted by the Registrar:</p>
            
            <!--<xsl:call-template name="section_d1_current_status_template"/>-->
                
            <table class="table">
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption">Date Of Letter Under Section 308 (1)</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:letter_date_under_308_1"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Date Of Letter Under Section 308 (2)</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:letter_date_under_308_2"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Date Of Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Date Of Striking Off / Dissolution Company</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:strike_off_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_strike_off"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:remark1, ' ', r:remark2)"/>
                        </xsl:call-template>
                    </td>
                </tr>           
                
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>
            
            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_CD -->
    
    <!-- start section_d1_CF -->
    <xsl:template name="section_d1_CF_template">
        
        <xsl:if test="@rpttype = 'CF'">
            
            <p class="title">
                <xsl:value-of select="@seq"/>. COMPANY UNDER SPECIAL ADMINISTRATION (PAST &amp; CURRENT)
            </p>
                
            <table class="table">
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_lc_verification_template"/>
                <tr>
                    <th class="caption" rowspan="4">Administrator</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:administrator1"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:administrator2"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:administrator3"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:administrator4"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                
                <tr>
                    <th class="caption">Date Appointed</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:appoint_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Date Discharge</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:discharge_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Independent Advisor</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:independent"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:remark"/>
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_further_info_contact_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>
            
            </table>
            
            <p class="notice">Special Administrators (SA) are appointed by Danaharta (National Asset Management Company) under the Danaharta Act 1998 to manage the affairs of distressed companies. Unless extended, a moratorium of 12 months (from date of appointment) comes into effect against all claims and legal proceedings against the company. SA are discharged upon successful restructuring of the company. For the latest status, please check with Danaharta or the SA directly.</p>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_CF -->

    <!-- start section_d2_C1 -->
    <xsl:template name="section_d2_C1_template">
        
        <xsl:if test="@rpttype = 'C1'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
            <p class="header">WINDING UP</p>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Defendant</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="section_d2_other_company_template"/>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Object</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:object"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Incorporation Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:incoporate_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Last Annual Return Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:return_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Authorised Capital</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number_no_zero">
                            <xsl:with-param name="number" select="r:capital"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Paid-Up Capital</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number_no_zero">
                            <xsl:with-param name="number" select="r:paidup"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Petitioner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:petitioner"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Petition Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:petition) or r:petition = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:petition and r:petition != ''">
                            <xsl:for-each select="r:petition">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_petition"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:order) or r:order = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:order and r:order != ''">
                            <xsl:for-each select="r:order">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_order"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">CCM Search Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:cpo_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:remark1, ' ', r:remark2, ' ', r:remark3, ' ', r:remark4)"/>
                        </xsl:call-template>
                    </td>
                </tr>                            
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_liquidator_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d2_C1 -->

    <!-- start section_d2_C2 -->
    <xsl:template name="section_d2_C2_template">
        
        <xsl:if test="@rpttype = 'C2'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
            <p class="header">SUMMONS</p>

            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Defendant</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="section_d2_other_company_template"/>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Action Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="not(r:action) or r:action = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:action and r:action != ''">
                            <xsl:for-each select="r:action">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Hearing Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:remark1, ' ', r:remark2, ' ', r:remark3, ' ', r:remark4)"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_cedcon_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d2_C2 -->

    <!-- start section_d1_I1 -->
    <xsl:template name="section_d1_I1_template">

        <xsl:if test="@rpttype = 'I1'">

            <p class="header">
                <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
            </p>

            <xsl:call-template name="section_d1_current_status_template"/>

            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:name"/>
                        <xsl:if test="r:alias != ''"> 
                            @ <xsl:value-of select="r:alias"/>
                        </xsl:if>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_id_verification_template"/>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Firm</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:firm"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Exparte</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:exparte"/>
                        </xsl:call-template>
                    </td>
                    
                    
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
					
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                    <!--
<th class="caption">Court</th>
<td class="short-content">
    <xsl:call-template name="check_empty_string">
        <xsl:with-param name="value" select="r:court_detail"/>
    </xsl:call-template>
</td>
                    -->
                </tr>
                <tr>
                    <th class="caption">Notice Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:notice) or r:notice = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:notice and r:notice != ''">
                            <xsl:for-each select="r:notice">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_notice"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Petition Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:petition) or r:petition = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:petition and r:petition != ''">
                            <xsl:for-each select="r:petition">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_petition"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:order) or r:order = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:order and r:order != ''">
                            <xsl:for-each select="r:order">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_order"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Annulment/Disc</th>
                    <td class="short-content">
                        <xsl:if test="not(r:release) or r:release = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:release and r:release != ''">
                            <xsl:for-each select="r:release">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_discharge"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_exparte_contact_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_I1 -->

    <!-- start section_d1_I2 -->
    <xsl:template name="section_d1_I2_template">
        
        <xsl:if test="@rpttype = 'I2'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_id_verification_template"/>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Firm</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:firm"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Plaintiff</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:plaintiff"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Action Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="not(r:action) or r:action = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:action and r:action != ''">
                            <xsl:for-each select="r:action">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Hearing Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_plaintiff_cedcon_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_I2 -->

    <!-- start section_d1_I4 -->
    <xsl:template name="section_d1_I4_template">
        
        <xsl:if test="@rpttype = 'I4'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:name"/>
                        <xsl:if test="r:alias != ''">
                            @ <xsl:value-of select="r:alias"/>
                        </xsl:if>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_id_verification_template"/>
                <tr>
                    <th class="caption">Status</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:position"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Appointed</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:appoint"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Resigned Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:resign_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Respondent</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:respondent"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Registration No.</th>
                    <td class="short-content">
                        <xsl:if test="r:local != '' and r:locala != ''">
                            (<xsl:value-of select="r:local"/>-<xsl:value-of select="r:locala"/>)
                        </xsl:if>
                        <xsl:if test="r:local != '' and r:locala = ''">
                            (<xsl:value-of select="r:local"/>)
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Object</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:object"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Incorporation Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:incoporate_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Last Annual Return Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:return_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Shareholding</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:shareholding"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Capital</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number_no_zero">
                            <xsl:with-param name="number" select="r:capital"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Paid-Up Capital</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number_no_zero">
                            <xsl:with-param name="number" select="r:paidup"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Petitioner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:petitioner"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Petition Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:petition) or r:petition = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:petition and r:petition != ''">
                            <xsl:for-each select="r:petition">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette_petition"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Indebtedness</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <xsl:if test="r:order != ''">
                    <tr>
                        <th class="caption">Wound-Up</th>
                        <td class="short-content">
                            <xsl:if test="not(r:order) or r:order = ''">
                                -
                            </xsl:if>
                            <xsl:if test="r:order and r:order != ''">
                                <xsl:for-each select="r:order">
                                    <p>
                                        <xsl:call-template name="check_empty_string">
                                            <xsl:with-param name="value" select="r:date"/>
                                        </xsl:call-template>
                                        &#160;
                                        <xsl:call-template name="check_empty_string">
                                            <xsl:with-param name="value" select="r:source_detail"/>
                                        </xsl:call-template>
                                    </p>
                                </xsl:for-each>
                            </xsl:if>
                        </td>
                        
                        <th class="caption">Gazette</th>
                        <td class="short-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:gazette_order"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                </xsl:if>
                <tr>
                    <th class="caption">Search Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:cpo_date"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_exparte_contact_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>
            
            </table>
            
            <p class="notice">NB: The above information only aim to show that the subject was a director at the time the company was petitioned for winding-up. Please note that the information does not in any way imply or attemp to suggest that the named director is under any legal action or that he/she has any guarantee exposure to the petitioner or other creditors.
                <br/>Director's details are extracted based on returns available at the CCM at the time the search was conducted. In cases where the company has failed to submit returns, the last set of available returns listing the directors are taken. Please make due enquiry for confirmation.
                <br/>Winding-up orders, where issued, may subsequently be stayed. Please check with the relevent parties.</p>

            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_I4 -->

    <!-- start section_d1_I5 -->
    <xsl:template name="section_d1_I5_template">
        
        <xsl:if test="@rpttype = 'I5'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:name"/>
                        <xsl:if test="r:alias != ''">
                            @ <xsl:value-of select="r:alias"/>
                        </xsl:if>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_id_verification_template"/>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Assignee</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:assignee"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Loan Agreement/<br/>Assignment</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:assignment_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Reserve Price</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:reserve_price"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Auction Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:auction) or r:auction = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:auction and r:auction != ''">
                            <xsl:for-each select="r:auction">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_exparte_contact_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>
                
            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_I5 -->

    <!-- start section_d1_I6 -->
    <xsl:template name="section_d1_I6_template">
        
        <xsl:if test="@rpttype = 'I6'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:name"/>
                        <xsl:if test="r:alias != ''">
                            @ <xsl:value-of select="r:alias"/>
                        </xsl:if>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_id_verification_template"/>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Plaintiff</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:plaintiff"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Originating Summons Dated</th>
                    <td class="short-content">
                        <xsl:if test="not(r:originating_summons) or r:originating_summons = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:originating_summons and r:originating_summons != ''">
                            <xsl:for-each select="r:originating_summons">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Outstanding Amount</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:outstanding_amount"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order For Sale Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:order_for_sale_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Reserve Price</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:reserve_price"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Auction Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:auction) or r:auction = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:auction and r:auction != ''">
                            <xsl:for-each select="r:auction">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_exparte_contact_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_I6 -->

    <!-- start section_d1_I7 -->
    <xsl:template name="section_d1_I7_template">
        
        <xsl:if test="@rpttype = 'I7'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:name"/>
                        <xsl:if test="r:alias != ''">
                            @ <xsl:value-of select="r:alias"/>
                        </xsl:if>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_id_verification_template"/>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Chargee</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:chargee"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Notice Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="not(r:notice) or r:notice = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:notice and r:notice != ''">
                            <xsl:for-each select="r:notice">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Outstanding Amount</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:outstanding_amount"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order For Sale Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:order_for_sale_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Reserve Price</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:reserve_price"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Auction Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:auction) or r:auction = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:auction and r:auction != ''">
                            <xsl:for-each select="r:auction">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_exparte_contact_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_I7 -->

    <!-- start section_d1_I8 -->
    <xsl:template name="section_d1_I8_template">
        
        <xsl:if test="@rpttype = 'I8'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:name"/>
                        <xsl:if test="r:alias != ''">
                            @ <xsl:value-of select="r:alias"/>
                        </xsl:if>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_id_verification_template"/>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Chargee</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:chargee"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Notice Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:notice) or r:notice = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:notice and r:notice != ''">
                            <xsl:for-each select="r:notice">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Outstanding Amount</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:outstanding_amount"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_exparte_contact_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_I8 -->

    <!-- start section_d1_I9 -->
    <xsl:template name="section_d1_I9_template">
        
        <xsl:if test="@rpttype = 'I9'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:name"/>
                        <xsl:if test="r:alias != ''">
                            @ <xsl:value-of select="r:alias"/>
                        </xsl:if>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_id_verification_template"/>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Plaintiff</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:plaintiff"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Outstanding Amount</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:outstanding_amount"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Order For Sale Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:order_for_sale_date"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Reserve Price</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:reserve_price"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Auction Date</th>
                    <td class="short-content">
                        <xsl:if test="not(r:auction) or r:auction = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:auction and r:auction != ''">
                            <xsl:for-each select="r:auction">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                    <th class="caption">Gazette</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:gazette"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Location</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_location"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Property Description</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:property_description"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registered Owner</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:register_owner"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_auctioneer_template"/>
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_exparte_contact_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_I9 -->

    <!-- start section_d1_ID -->
    <xsl:template name="section_d1_ID_template">
        
        <xsl:if test="@rpttype = 'ID'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Respondant</th>
                    <td class="long-content" colspan="3">
                        <xsl:value-of select="r:name"/>
                        <xsl:if test="r:alias != ''">
                            @ <xsl:value-of select="r:alias"/>
                        </xsl:if>
                    </td>
                </tr>
                <xsl:call-template name="section_d1_id_verification_template"/>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>        
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Applicant</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:applicant"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Action Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="not(r:action) or r:action = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:action and r:action != ''">
                            <xsl:for-each select="r:action">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Hearing Date</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
                <xsl:call-template name="section_d1_applicant_contact_template"/>
                <xsl:call-template name="section_d1_other_parties_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_ID -->

    <!-- start section_d2_I2 -->
    <xsl:template name="section_d2_I2_template">
        
        <xsl:if test="@rpttype = 'I2'">
                
            <xsl:if test="r:title != ''">
                <p class="header">
                    <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
                </p>
            </xsl:if>
                
            <xsl:call-template name="section_d1_current_status_template"/>
                
            <table class="table">
                <tr>
                    <th class="caption">Special Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:special_remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Defendant</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="r:other_defendants/r:other_defendant">
            
                            <xsl:for-each select="r:other_defendants/r:other_defendant">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:name"/>
                                    </xsl:call-template>
                                    <xsl:if test="r:nic_brno != '' and r:ic_lcno = ''">
                                        &#160;(<xsl:value-of select="r:nic_brno"/>)
                                    </xsl:if>
                                    <xsl:if test="r:nic_brno = '' and r:ic_lcno != ''">
                                        &#160;(<xsl:value-of select="r:ic_lcno"/>)
                                    </xsl:if>
                                    <xsl:if test="r:nic_brno != '' and r:ic_lcno != ''">
                                        &#160;(<xsl:value-of select="r:nic_brno"/> / <xsl:value-of select="r:ic_lcno"/>)
                                    </xsl:if>
                                </p>
                            </xsl:for-each>
            
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:addr"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Firm</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:firm"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Case No.</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:case_no"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Court</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:court_detail"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Action Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:if test="not(r:action) or r:action = ''">
                            -
                        </xsl:if>
                        <xsl:if test="r:action and r:action != ''">
                            <xsl:for-each select="r:action">
                                <p>
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:date"/>
                                    </xsl:call-template>
                                    &#160;
                                    <xsl:call-template name="check_empty_string">
                                        <xsl:with-param name="value" select="r:source_detail"/>
                                    </xsl:call-template>
                                </p>
                            </xsl:for-each>
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Hearing Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:hear_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_number">
                            <xsl:with-param name="number" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                
                <xsl:call-template name="section_d1_solicitor_template"/>
                <xsl:call-template name="section_d1_plaintiff_cedcon_template"/>
                <xsl:call-template name="section_d1_settlement_template"/>
                <xsl:call-template name="section_d1_latest_status_template"/>
                <xsl:call-template name="section_d1_subject_comment_template"/>
                <xsl:call-template name="section_d1_cra_comment_template"/>

            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d2_I2 -->

    <!-- start section_d1_X4 -->
    <xsl:template name="section_d1_X4_template">
        
        <xsl:if test="@rpttype = 'X4'">

            <!--<xsl:call-template name="section_d1_current_status_template"/>-->
            <xsl:for-each select="r:withheld">
                
                <p class="title">
                    <xsl:value-of select="r:message"/>
                </p>

            </xsl:for-each>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_X4 -->

    <!-- start section_d3_Sn -->
    <xsl:template name="section_d3_Sn_template">
                
        <xsl:if test="@rpttype = 'Sn'">
        
            <p class="notice">
                Anti Money Laundering Act your enquiry has been screened against database complied from the following sources which are used frequently for AMLA (Anti Money Laundering Act) screening (a) UN Security Council resolution 1267 list (b) United States Dept. of the Treasure Specially Designated Nationals.
                <br/>Please note that a “Name Match” does not mean the subject enquiry id in fact the entity referred to in the AMLA list. Please conduct your own further probe with the relevant authorities for confirmation.
            </p>
        
            <table class="table">
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Also Known As</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:known_as"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">ID</th>
                    <td class="long-content" colspan="3">
                        <xsl:for-each select="r:ids">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:id"/>
                            </xsl:call-template>
                        </xsl:for-each>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Nationality</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:nationality"/>
                        </xsl:call-template>
                    </td>
                </tr>
            </table>
        
            <br/>
        
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d3_Sn -->

    <!-- start section_d3_Un -->
    <xsl:template name="section_d3_Un_template">
         
        <xsl:if test="@rpttype = 'Un'">
               
            <p class="notice">
                Anti Money Laundering Act your enquiry has been screened against database complied from the following sources which are used frequently for AMLA (Anti Money Laundering Act) screening (a) UN Security Council resolution 1267 list (b) United States Dept. of the Treasure Specially Designated Nationals.
                <br/>Please note that a “Name Match” does not mean the subject enquiry id in fact the entity referred to in the AMLA list. Please conduct your own further probe with the relevant authorities for confirmation.
            </p>
        
            <table class="table">
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Also Known As</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:known_as"/>
                        </xsl:call-template>
                    </td>
                </tr>            
                <tr>
                    <th class="caption">Nationality</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:nationality"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">ID</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:id"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Date Of Birth</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:birth_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Date Of Place</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:birth_place"/>
                        </xsl:call-template>
                    </td>
                </tr>
            </table>
        
            <br/>
        
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d3_Un -->

    <!-- start section_d1_current_status -->
    <xsl:template name="section_d1_current_status_template">
        
        <xsl:if test="@rpttype != 'CD' or @rpttype != 'X4'">
            
            <p class="notice">Note: The record below is NOT intended to reflect the 'current status' of the case. Any judgement, order or action where indicated, could have subsequently been settled, quashed, rescinded, revoked, set aside, annulled, struck off or dismissed. Please check with the relevant parties.</p>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_current_status -->

    <!-- start section_d1_lc_verification -->
    <xsl:template name="section_d1_lc_verification_template">
        
        <tr>
            <th class="caption">Registration No.</th>
            
            <td class="long-content" colspan="3">
                <xsl:call-template name="display_old_new_reg_no">
                    <xsl:with-param name="reg_num_1" select="r:ic_lcno" />
                    <xsl:with-param name="reg_num_2" select="r:nic_brno" />
                </xsl:call-template>
            </td>
        </tr>
        
    </xsl:template>
    <!-- finish section_d1_id_verification -->
 
    <!-- start section_d1_id_verification -->
    <xsl:template name="section_d1_id_verification_template">
        <tr>
            <th class="caption">New ID</th>
            <td class="long-content" colspan="3">
                <xsl:call-template name="check_empty_string">
                    <xsl:with-param name="value" select="r:nic_brno"/>
                </xsl:call-template>
                <xsl:if test="r:nic_brno[@match = '1']">
                    (NEW ID MATCH)
                </xsl:if>
                <xsl:if test="r:nic_brno[@match = '0']">
                    (NEW ID DIFFER)
                </xsl:if>
            </td>
        </tr>
        <tr>
            <th class="caption">Old ID</th>
            <td class="long-content" colspan="3">
                <xsl:call-template name="check_empty_string">
                    <xsl:with-param name="value" select="r:ic_lcno"/>
                </xsl:call-template>
                <xsl:if test="r:ic_lcno[@match = '1']">
                    (ID MATCH)
                </xsl:if>
                <xsl:if test="r:ic_lcno[@match = '0']">
                    (ID DIFFER)
                </xsl:if>
            </td>
        </tr>
    </xsl:template>
    <!-- finish section_d1_id_verification -->

    <!-- start section_d1_applicant_contact -->
    <xsl:template name="section_d1_applicant_contact_template">
        
        <xsl:if test="r:cedcon != ''">
            
            <xsl:for-each select="r:cedcon">
                
                <tr>
                    <th class="caption">Applicant</th>
                    <td class="short-content" colspan="3">
                        <xsl:value-of select="r:name"/>
                    </td>
                    
                    <th class="caption">Tel</th>
                    <td class="short-content" colspan="3">
                        <xsl:value-of select="r:tel"/>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Contact</th>
                    <td class="short-content">
                        <p>
                            <xsl:value-of select="r:add1"/>
                        </p>
                        <p>
                            <xsl:value-of select="r:add2"/>
                        </p>
                        <p>
                            <xsl:if test="r:add3 != '' and r:add4 != ''">
                                <xsl:value-of select="r:add3"/>, <xsl:value-of select="r:add4"/>
                            </xsl:if>
                            <xsl:if test="r:add3 != '' and r:add4 = ''">
                                <xsl:value-of select="r:add3"/>
                            </xsl:if>
                            <xsl:if test="r:add3 = '' and r:add4 != ''">
                                <xsl:value-of select="r:add4"/>
                            </xsl:if>
                            <xsl:if test="(not(r:add3) and not(r:add4)) or (r:add3 = '' and r:add4 = '')">
                                -
                            </xsl:if>
                        </p>
                    </td>
                    <th class="caption">Ref</th>
                    <td class="short-content">
                            
                        <xsl:if test="r:ref != ''">
                            <xsl:value-of select="r:ref"/>
                        </xsl:if>
                            
                    </td>
                </tr>
                
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_applicant_contact -->
    
    <!-- start section_d1_auctioneer -->
    <xsl:template name="section_d1_auctioneer_template">
        
        <xsl:if test="r:auctioneer != ''">
            
            <xsl:for-each select="r:auctioneer">
                
                <tr>
                    <th class="caption">Auctioneer</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>                        
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:add1, ' ', r:add2, ' ', r:add3, ' ', r:add4)"/>
                        </xsl:call-template>                        
                    </td>
                </tr>                
                <tr>
                    <th class="caption">Tel</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:tel"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Ref</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:ref"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_auctioneer -->

    <!-- start section_d1_cedcon -->
    <xsl:template name="section_d1_cedcon_template">
        
        <xsl:if test="r:cedcon != ''">
            
            <xsl:for-each select="r:cedcon">
                
                <tr>
                    <th class="caption">Cedcon</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>                        
                </tr>
                <tr>
                    <th class="caption" rowspan="3">Contact</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:add1"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:add2"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:if test="r:add3 != '' and r:add4 != ''">
                            <xsl:value-of select="r:add3"/>, <xsl:value-of select="r:add4"/>
                        </xsl:if>
                        <xsl:if test="r:add3 != '' and r:add4 = ''">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:add3"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="r:add3 = '' and r:add4 != ''">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:add4"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="(not(r:add3) and not(r:add4)) or (r:add3 = '' and r:add4 = '')">
                            -
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Tel</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:tel"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Ref</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:ref"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_cedcon -->

    <!-- start section_d1_exparte_contact -->
    <xsl:template name="section_d1_exparte_contact_template">
        
        <xsl:if test="r:cedcon != ''">
            
            <xsl:for-each select="r:cedcon">
                
                <tr>
                    <th class="caption">Exparte</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>                        
                </tr>
                <tr>
                    <th class="caption" rowspan="3">Contact</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:add1"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:add2"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:if test="r:add3 != '' and r:add4 != ''">
                            <xsl:value-of select="r:add3"/>, <xsl:value-of select="r:add4"/>
                        </xsl:if>
                        <xsl:if test="r:add3 != '' and r:add4 = ''">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:add3"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="r:add3 = '' and r:add4 != ''">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:add4"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="(not(r:add3) and not(r:add4)) or (r:add3 = '' and r:add4 = '')">
                            -
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Tel</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:tel"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Ref</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:ref"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_exparte_contact -->
 
    <!-- start section_d1_further_info_contact -->
    <xsl:template name="section_d1_further_info_contact_template">
        
        <xsl:if test="r:further_info_contact != ''">
            
            <xsl:for-each select="r:further_info_contact">
                
                <tr>
                    <th class="caption">Further Info</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>                        
                </tr>
                <tr>
                    <th class="caption" rowspan="3">Contact</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:add1"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:add2"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:if test="r:add3 != '' and r:add4 != ''">
                            <xsl:value-of select="r:add3"/>, <xsl:value-of select="r:add4"/>
                        </xsl:if>
                        <xsl:if test="r:add3 != '' and r:add4 = ''">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:add3"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="r:add3 = '' and r:add4 != ''">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:add4"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="(not(r:add3) and not(r:add4)) or (r:add3 = '' and r:add4 = '')">
                            -
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Tel</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:tel"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Ref</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:ref"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_further_info_contact -->

    <!-- start section_d1_liquidator -->
    <xsl:template name="section_d1_liquidator_template">
        
        <xsl:if test="r:liq != ''">
            
            <xsl:for-each select="r:liq">
                
                <tr>
                    <th class="caption">Liquidator</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>                        
                </tr>
                <tr>
                    <th class="caption">Address</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="concat(r:add1, ' ', r:add2, ' ', r:add3, ' ', r:add4)"/>
                        </xsl:call-template>                        
                    </td>
                </tr>
                <tr>
                    <th class="caption">Tel</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:tel"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Ref</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:ref"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_liquidator -->

    <!-- start section_d1_plaintiff_cedcon -->
    <xsl:template name="section_d1_plaintiff_cedcon_template">
        
        <xsl:if test="r:cedcon != ''">
            
            <xsl:for-each select="r:cedcon">
                
                <tr>
                    <th class="caption">Plaintiff Cedcon</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>                        
                </tr>
                <tr>
                    <th class="caption" rowspan="3">Contact</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:add1"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:add2"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:if test="r:add3 != '' and r:add4 != ''">
                            <xsl:value-of select="r:add3"/>, <xsl:value-of select="r:add4"/>
                        </xsl:if>
                        <xsl:if test="r:add3 != '' and r:add4 = ''">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:add3"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="r:add3 = '' and r:add4 != ''">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:add4"/>
                            </xsl:call-template>
                        </xsl:if>
                        <xsl:if test="(not(r:add3) and not(r:add4)) or (r:add3 = '' and r:add4 = '')">
                            -
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Tel</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:tel"/>
                        </xsl:call-template>
                    </td>
                    
                    <th class="caption">Ref</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:ref"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_plaintiff_cedcon -->

    <!-- start section_d1_solicitor -->
    <xsl:template name="section_d1_solicitor_template">

        <xsl:if test="r:lawyer != ''">

            <xsl:for-each select="r:lawyer">

                <xsl:if test="r:name and r:name != ''">
                
                    <tr>
                        <th class="caption">Solicitor</th>
                        <td class="long-content" colspan="3">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:name"/>
                            </xsl:call-template>
                        </td>                        
                    </tr>
                    <tr>
                        <th class="caption">Address</th>
                        <td class="long-content" colspan="3">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="concat(r:add1, ' ', r:add2, ' ', r:add3, ' ', r:add4)"/>
                            </xsl:call-template>                        
                        </td>
                    </tr>                
                    <tr>
                        <th class="caption">Tel</th>
                        <td class="short-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:tel"/>
                            </xsl:call-template>
                        </td>
                    
                        <th class="caption">Ref</th>
                        <td class="short-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:ref"/>
                            </xsl:call-template>
                        </td>
                    </tr>

                </xsl:if>

            </xsl:for-each>

        </xsl:if>

    </xsl:template>
    <!-- finish section_d1_solicitor -->

    <!-- start section_d2_other_company -->
    <xsl:template name="section_d2_other_company_template">
        
        <xsl:if test="r:other_defendants/r:other_defendant">
            <xsl:for-each select="r:other_defendants/r:other_defendant">
                
                <p>
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:name"/>
                    </xsl:call-template>
                    <xsl:if test="r:nic_brno != '' and r:ic_lcno = ''">
                        &#160;(<xsl:value-of select="r:nic_brno"/>)
                    </xsl:if>
                    <xsl:if test="r:nic_brno = '' and r:ic_lcno != ''">
                        &#160;(<xsl:value-of select="r:ic_lcno"/>)
                    </xsl:if>
                    <xsl:if test="r:nic_brno != '' and r:ic_lcno != ''">
                        &#160;(<xsl:value-of select="r:ic_lcno"/> / <xsl:value-of select="r:nic_brno"/>)
                    </xsl:if>
                </p>
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_other_company -->
     
    <!-- start section_d1_other_parties -->
    <xsl:template name="section_d1_other_parties_template">
        
        <xsl:if test="r:other_defendants/r:other_defendant">
            
            <tr>
                <td class="header" colspan="4">
                    OTHER PARTIES MENTIONED IN THE SAME CASE AS THE ABOVE <xsl:value-of select="r:case_no"/>
                </td>
            </tr>
            
            <xsl:for-each select="r:other_defendants/r:other_defendant">
                <tr>
                    <td colspan="4">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                        <xsl:if test="r:nic_brno != '' and r:ic_lcno = ''">
                            &#160;(<xsl:value-of select="r:nic_brno"/>)
                        </xsl:if>
                        <xsl:if test="r:nic_brno = '' and r:ic_lcno != ''">
                            &#160;(<xsl:value-of select="r:ic_lcno"/>)
                        </xsl:if>
                        <xsl:if test="r:nic_brno != '' and r:ic_lcno != ''">
                            &#160;(<xsl:value-of select="r:nic_brno"/> / <xsl:value-of select="r:ic_lcno"/>)
                        </xsl:if>
                    </td>
                </tr>
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_other_parties -->

    <!-- start section_d1_director -->
    <xsl:template name="section_d1_director_template">
        
        <xsl:if test="r:directors/r:director">
            
            <xsl:variable name="case_no">
                <xsl:value-of select="r:case_no"/>
            </xsl:variable>
            
            <xsl:for-each select="r:directors/r:director">
                
                <xsl:if test="r:name and r:name != ''">
                
                    <tr>
                        <td class="header" colspan="4">
                            <xsl:value-of select="@seq"/>. DIRECTORS OF THE COMPANY - <xsl:value-of select="r:name"/>
                        </td>
                    </tr>
                
                    <tr>
                        <th class="caption">Solicitor</th>
                        <td class="long-content" colspan="3">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:name"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                    <tr>
                        <th class="caption">Old ID</th>
                        <td class="long-content" colspan="3">
                            <xsl:if test="not(r:nic_brno) or r:nic_brno = ''">
                                <xsl:call-template name="check_empty_string">
                                    <xsl:with-param name="value" select="r:ic_lcno"/>
                                </xsl:call-template>
                            </xsl:if>
                            <xsl:if test="r:nic_brno and r:nic_brno != ''">
                                <xsl:if test="r:ic_lcno = ''">
                                    <xsl:value-of select="r:nic_brno"/>
                                </xsl:if>
                                <xsl:if test="r:ic_lcno != ''">
                                    <xsl:value-of select="r:nic_brno"/> / <xsl:value-of select="r:ic_lcno"/>
                                </xsl:if>    
                            </xsl:if>
                        </td>
                    </tr>
                    <tr>
                        <th class="caption">Shareholdings</th>
                        <td class="short-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:shareholding"/>
                            </xsl:call-template>
                        </td>
                        
                        <th class="caption">CCM Search Date</th>
                        <td class="short-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:cpo_date"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                    <tr>
                        <th class="caption">Address</th>
                        <td class="long-content" colspan="3">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:addr"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                    <tr>
                        <th class="caption">Remark</th>
                        <td class="short-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:remark"/>
                            </xsl:call-template>
                        </td>
                        
                        <th class="caption">Ref</th>
                        <td class="short-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="$case_no"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                    <tr>
                        <th class="caption">Appointed</th>
                        <td class="short-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:appoint"/>
                            </xsl:call-template>
                        </td>
                        
                        <th class="caption">Resigned Date</th>
                        <td class="short-content">
                            <xsl:call-template name="check_empty_string">
                                <xsl:with-param name="value" select="r:resign_date"/>
                            </xsl:call-template>
                        </td>
                    </tr>
                
                </xsl:if>
                
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_director -->

    <!-- start section_d1_settlement -->
    <xsl:template name="section_d1_settlement_template">
        <xsl:if test="r:settlement != ''">
            <xsl:for-each select="r:settlement">
                <tr>
                    <th class="caption">Settlement</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:code"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Settled Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:date"/>
                        </xsl:call-template>
                    </td>
                </tr>
            </xsl:for-each>
        </xsl:if>
    </xsl:template>
    <!-- finish section_d1_settlement -->

    <!-- start section_d1_latest_status -->
    <xsl:template name="section_d1_latest_status_template">
        
        <xsl:if test="r:latest_status != ''">
            
            <xsl:for-each select="r:latest_status">
                
                <tr>
                    <td class="header" colspan="4">
                        SUBJECT'S CONFIRMATION OF STATUS AS OF 
                        <xsl:if test="r:date != ''">
                            <xsl:value-of select="r:date"/>.
                        </xsl:if>
                    </td>
                </tr>

                <tr>
                    <th class="caption">Status</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:code"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
                <tr>
                    <td class="header" colspan="4">
                        THIS STATUS WAS UPDATED ON <xsl:value-of select="r:update_date"/>
                    </td>
                </tr>
                
                <tr>
                    <th class="caption">Source Of Update</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:source"/>
                        </xsl:call-template>
                    </td>
                </tr>
                    
                <tr>
                    <th class="caption">Source Dated</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:source_date"/>
                        </xsl:call-template>
                    </td>
                </tr>

                <tr>
                    <th class="caption">Next Review Date</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:exp_date"/>
                        </xsl:call-template>
                    </td>
                </tr>
                
            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_latest_status -->

    <!-- start section_d1_subject_comment -->
    <xsl:template name="section_d1_subject_comment_template">
        
        <xsl:if test="r:subject_cmt != ''">
            
            <xsl:for-each select="r:subject_cmt">
                
                <tr>
                    <td class="header" colspan="4">
                        SUBJECT, PLAINTIFF OR THEIR LEGAL REPRESENTATIVE COMMENTS AS OF <xsl:value-of select="r:comment_date"/>.
                    </td>
                </tr>
                
                <tr>
                    <td colspan="4">
                        <xsl:value-of select="r:comment"/>
                    </td>
                </tr>

            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_subject_comment -->

    <!-- start section_d1_cra_comment -->
    <xsl:template name="section_d1_cra_comment_template">
        
        <xsl:if test="r:cra_cmt != ''">
            
            <xsl:for-each select="r:cra_cmt">

                <tr>
                    <td class="header" colspan="4">
                        CRA COMMENTS AS OF <xsl:value-of select="r:comment_date"/>.
                    </td>
                </tr>
                
                <tr>
                    <td colspan="4">
                        <xsl:value-of select="r:comment"/>
                    </td>
                </tr>

            </xsl:for-each>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d1_cra_comment -->
    
    <!-- start section_d4_legal_cases -->
    <xsl:template name="section_d4_legal_cases_template">
        
        <xsl:if test="@rpttype = 'X4'">
                
            <p class="title">
                <xsl:value-of select="r:withheld/r:message"/>
            </p>
            
            <br/>
            
        </xsl:if>
        <xsl:if test="@rpttype = 'I4'">
                
            <p class="title">
                <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
            </p>
            <xsl:call-template name="section_d4_I4_template"/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish section_d4_legal_cases -->
    
    <!-- start section_d4_I4 -->
    <xsl:template name="section_d4_I4_template">

        <table class="table">
            <tr>
                <th class="caption">Special Remark</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:special_remark"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Name</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:name"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">New ID</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:nic_brno"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Old ID</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:ic_lcno"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Status</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:position"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Wound-up Date</th>
                <td class="short-content">
                    <xsl:call-template name="join_string">
                        <xsl:with-param name="value1" select="r:order/r:date"/>
                        <xsl:with-param name="value2" select="r:order/r:source_detail"/>
                    </xsl:call-template>
                </td>
                <th class="caption">Gazette</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:gazette_order"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Appointed Date</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:appoint_date"/>
                    </xsl:call-template>
                </td>
                <th class="caption">Resigned Date</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:resigned_date"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Remark</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:remark"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Address</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:addr"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Respondent</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:respondent"/>
                    </xsl:call-template>
                </td>
                <th class="caption">Registration No.</th>
                <td class="short-content">
                    <xsl:variable name="output">
                    <xsl:call-template name="display_old_new_reg_no">
                        <xsl:with-param name="reg_num_1" select="r:local" />
                        <xsl:with-param name="reg_num_2" select="r:additional_registration_no" />
                    </xsl:call-template>
                    </xsl:variable>
                    <xsl:choose>
                        <xsl:when test="$output and $output != ''">
                            <xsl:copy-of select="$output" />
                        </xsl:when>
                        <xsl:otherwise>
                            <xsl:text>-</xsl:text>
                        </xsl:otherwise>
                    </xsl:choose>
                </td>
            </tr>
            <tr>
                <th class="caption">Object</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:object"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Incorporation Date</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:incoporate_date"/>
                    </xsl:call-template>
                </td>
                <th class="caption">Capital</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:capital"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Paid-up Capital</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:paidup"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Petitioner</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:petitioner"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Case No.</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:case_no"/>
                    </xsl:call-template>
                </td>
                <th class="caption">Court</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:court_detail"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Petition Date</th>
                <td class="short-content">
                    <xsl:call-template name="join_string">
                        <xsl:with-param name="value1" select="r:petition/r:date"/>
                        <xsl:with-param name="value2" select="r:petition/r:source_detail"/>
                    </xsl:call-template>
                </td>
                <th class="caption">Gazette</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:gazette_petition"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Hearing Date</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:hear_date"/>
                    </xsl:call-template>
                </td>
                <th class="caption">Indebtedness</th>
                <td class="short-content">
                    <xsl:call-template name="check_empty_number_no_zero">
                        <xsl:with-param name="number" select="r:amount"/>
                    </xsl:call-template>
                </td>
            </tr>
            <tr>
                <th class="caption">Search Date</th>
                <td class="long-content" colspan="3">
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:cpo_date"/>
                    </xsl:call-template>
                </td>
            </tr>                       

            <xsl:call-template name="section_d1_solicitor_template"/>
            <xsl:call-template name="section_d1_exparte_contact_template"/>
            <xsl:call-template name="section_d1_settlement_template"/>
            <xsl:call-template name="section_d1_latest_status_template"/>
            <xsl:call-template name="section_d1_subject_comment_template"/>
            <xsl:call-template name="section_d1_cra_comment_template"/>

        </table>
            
        <p class="notice">Note: The above information only aim to show that the subject was a director at the time the company was petitioned for winding-up. Please note that the information does not in any way imply or attemp to suggest that the named director is under any legal action or that he/she has any guarantee exposure to the petitioner or other creditors.
            <br/>Director's details are extracted based on returns available at the CCM at the time the search was conducted. In cases where the company has failed to submit returns, the last set of available returns listing the directors are taken. Please make due enquiry for confirmation.
            <br/>Winding-up orders, where issued, may subsequently be stayed. Please check with the relevent parties.</p>
            
        <br/>
        
    </xsl:template>
    <!-- finish section_d4_I4 -->
</xsl:stylesheet>