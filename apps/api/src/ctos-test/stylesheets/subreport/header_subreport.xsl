<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/response"
                exclude-result-prefixes="xsl r">
    
    <!-- start ctos_header_template -->
    <xsl:template name="ctos_header_template">
        
        <table style="border: 0px; padding: 0px 0px 0px 0px; width: 100%;">
            <tr>
                <td style="width: 60%;">
                    <xsl:call-template name="header_template"/>
                </td>
                
                <td style="width: 40%;">
                    <xsl:call-template name="ctos_report_title_template"/>   
                </td>
            </tr>            
        </table>
        
        <hr class="separator"/>
        
    </xsl:template>
    <!-- finish ctos_header_template -->
    
    <!-- start fico_header_template -->
    <xsl:template name="fico_header_template">
        
        <table style="border: 0px; padding: 0px 0px 0px 0px; width: 100%;">
            <tr>
                <td style="width: 65%;">
                    <xsl:call-template name="header_template"/>
                </td>
                
                <td style="width: 35%;">
                    <xsl:call-template name="fico_report_title_template"/>
                </td>
            </tr>            
        </table>
        
        <hr class="separator"/>
        
    </xsl:template>
    <!-- finish fico_header_template -->
    
    <!-- start lite_header_template -->
    <xsl:template name="lite_header_template">
        
        <table style="border: 0px; padding: 0px 0px 0px 0px; width: 100%;">
            <tr>
                <td style="width: 65%;">
                    <xsl:call-template name="header_template"/>
                </td>
                
                <td style="width: 35%;">
                    <xsl:call-template name="lite_report_title_template"/>
                </td>
            </tr>            
        </table>
        
        <hr class="separator"/>
        
    </xsl:template>
    <!-- finish lite_header_template -->
        
    <!-- start header_template -->
    <xsl:template name="header_template">
       
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
                    <xsl:value-of select="@id"/>
                </td>
                <td/>
            </tr>
            <tr>
                <th width="10%">
                    Attention
                </th>
                <td>:</td>
                <td>
                    <xsl:value-of select="r:header/r:user/@id"/>
                    <xsl:if test="r:header/r:user != ''">
                        (<xsl:value-of select="r:header/r:user"/>)
                    </xsl:if>
                </td>
                <td/>
            </tr>
            <tr>
                <th width="10%">
                    Account
                </th>
                <td>:</td>
                <td>
                    <xsl:value-of select="r:header/r:account"/>
                    <xsl:if test="r:header/r:company != ''">
                        (<xsl:value-of select="r:header/r:company"/>)
                    </xsl:if>
                </td>
                <td/>
            </tr>
            <tr>
                <th width="10%">
                    Date
                </th>
                <td>:</td>
                <td>
                    <xsl:value-of select="r:header/r:enq_date"/>
                    &#160;
                    <xsl:value-of select="r:header/r:enq_time"/>
                </td>
                <td/>
            </tr>
            <tr>
                <th width="10%">
                    Tel
                </th>
                <td>:</td>
                <td>
                    <xsl:call-template name="check_empty_string">
                        <xsl:with-param name="value" select="r:header/r:tel"/>
                    </xsl:call-template>
                </td>
            </tr>
            
            <xsl:if test="r:header/r:enq_status/@code != '1'">
                <tr>
                    <th width="10%">
                        <font color="red">
                            Error
                        </font>
                    </th>
                    <td>
                        <font color="red">
                            :
                        </font>
                    </td>
                    <td>
                        <font color="red">
                            <xsl:value-of select="r:header/r:enq_status"/>
                        </font>
                    </td>
                </tr>
            </xsl:if>
        </table>

    </xsl:template>
    <!-- finish header_template -->
    
    <!-- start ctos_report_title_template -->
    <xsl:template name="ctos_report_title_template">
        <xsl:if test="r:summary/r:enq_sum[1]/r:enq_code [@code != '11'] and r:summary/r:enq_sum[1]/r:enq_code [@code != '4']">
            <table class="table-header-right">
                <tr>
                    <th>
                        CTOS REPORT
                    </th>
                </tr>
            </table>
        </xsl:if>
        
        <xsl:if test="r:summary/r:enq_sum[1]/r:enq_code [@code = '11']">
            <table class="table-header-right">
                <tr>
                    <th>
                        CTOS SCORE REPORT
                    </th>
                </tr>
            </table>
        </xsl:if>    
        
        <xsl:if test="r:summary/r:enq_sum[1]/r:enq_code [@code = '4']">
            <table class="table-header-right">
                <tr>
                    <th>
                        CTOS SCORE REPORT
                    </th>
                </tr>
            </table>
        </xsl:if> 
    </xsl:template>
    <!-- finish ctos_report_title_template -->
    
    <!-- start fico_report_title_template -->
    <xsl:template name="fico_report_title_template">
       
        <table class="table-header-right">
            <tr>
                <th>
                    CTOS SCORE REPORT
                </th>
            </tr>
        </table>
        
    </xsl:template>
    <!-- finish fico_report_title_template -->
    
    <!-- start lite_report_title_template -->
    <xsl:template name="lite_report_title_template">
       
        <table class="table-header-right">
            <tr>
                <th>
                    CTOS LitE REPORT
                </th>
            </tr>
        </table>
        
    </xsl:template>
    <!-- finish ctos_report_title_template -->
    
</xsl:stylesheet>
