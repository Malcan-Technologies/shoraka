<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/kyc"
                exclude-result-prefixes="xsl r">
    
    <!-- start kyc_screening_header_template -->
    <xsl:template name="kyc_screening_header_template">
        
        <table style="border: 0px; padding: 0px 0px 0px 0px; width: 100%;">
            <tr>
                <td style="width: 65%;">
                    <xsl:call-template name="kyc_header_template"/>
                </td>
                
                <td style="width: 35%;">
                    <xsl:call-template name="kyc_screening_report_title_template"/>
                </td>
            </tr>
        </table>
        
        <!-- <br/> -->
        <!--The line that seperate the header and the content-->
        <hr class="seperator"/>
        
        <!-- <br/> -->
    </xsl:template>
    <!-- finish kyc_screening_header_template -->
    
    
    <!-- start KYC Screening Report header_template -->
    <xsl:template name="kyc_header_template">
       
        <table class="table-header-left">
            <tr>
                <th colspan="4" rowspan="7" width="32%">
                    <img>
                        <xsl:attribute name="src">
                            <xsl:call-template name="image_template">
                                <xsl:with-param name="image" select="'ctos.png'"/>
                            </xsl:call-template>
                        </xsl:attribute>
                        <xsl:attribute name="height">50</xsl:attribute>
                        <xsl:attribute name="width">115</xsl:attribute>
                    </img>
                </th>
                
                <th colspan="3">
                    Strictly Confidential
                </th>
            </tr>
            <tr>
                <th width="10%">
                    Report No.
                </th>
                <td>:</td>
                <td>
                    <xsl:value-of select="@uid"/>
                </td>
                <td/>
            </tr>
            <tr>
                <th width="10%">
                    Attention
                </th>
                <td>:</td>
                <td>
                    <xsl:value-of select="r:context/r:user_id"/>
                </td>
                <td/>
            </tr>
            <tr>
                <th width="10%">
                    Account
                </th>
                <td>:</td>
                <td>
                    <xsl:value-of select="r:context/r:account_no"/>
                    <!-- <xsl:if test="r:context/r:company_code != ''">
                        (<xsl:value-of select="r:context/r:company_code"/>)
                    </xsl:if> -->
                </td>
                <td/>
            </tr>
            <tr>
                <th width="10%">
                    Date
                </th>
                <td>:</td>
                <td>
                    <xsl:value-of select="r:context/r:request_date"/>
                </td>
                <td/>
            </tr>
        </table>

    </xsl:template>
    <!-- finish KYC Screening Report header_template -->
    
    
    <!-- start kyc_screening_report_title_template -->
    <xsl:template name="kyc_screening_report_title_template">
        
        <table class="table-header-right">
            <tr>
                <th>
                    KYC Screening REPORT
                </th>
            </tr>
        </table>
        
    </xsl:template>
    <!-- finish kyc_screening_report_title_template -->
    
</xsl:stylesheet>
