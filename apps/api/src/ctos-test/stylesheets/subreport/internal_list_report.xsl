<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/response"
                exclude-result-prefixes="xsl r">

    <xsl:template name="internal_list_template">
        
        <xsl:if test="@status = '1'">
            
            <p style="page-break-before: always;"/>
            
            <p class="title">
                INTERNAL LIST
            </p>
            
            <xsl:call-template name="internal_list_header_template"/>

            <xsl:for-each select="r:eil">
                
                <!-- commercial -->
                <xsl:call-template name="internal_list_Cd_template"/>
                
                <!-- individual -->
                <xsl:call-template name="internal_list_Id_template"/>
            
            </xsl:for-each>
        
            <p class="info-no-style text-center">
                <b>- End of Report -</b>
            </p>
            <br/>
        
        </xsl:if>
        
    </xsl:template>
    
    <!-- start internal_list_header -->
    <xsl:template name="internal_list_header_template">
        
        <xsl:if test="r:eil_request">
            
            <p class="header">Information provided for enquiry:</p>
        
            <table class="table">
                <tr>
                    <th class="caption">Name</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:eil_request/r:name"/>
                        </xsl:call-template>
                    </td>
                    <th class="caption">Done By</th>
                    <td class="short-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:eil_request/r:requester_name"/>
                        </xsl:call-template>
                        <xsl:if test="r:eil_request/r:requester_id != ''">
                            (<xsl:value-of select="r:eil_request/r:requester_id"/>)
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">ID / Registration No.</th>
                    <td class="short-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:eil_request/r:nicbr"/>
                        </xsl:call-template>
                        /
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:eil_request/r:iclc"/>
                        </xsl:call-template>
                    </td>
                </tr>
            </table>
            
            <p class="notice">Note: This notation pertains to the information that you may receive below:</p>
            <p class="notice">
                Internal Lists:
                <br/>
                The information that appears under this heading are information that have been uploaded by your own company.
                <br/>
                Should you have any query or questions that appears here please refer to the relevant department in your company.
            </p>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish internal_list_header --> 
    
    <!-- start internal_list_Cd -->
    <xsl:template name="internal_list_Cd_template">
        
        <xsl:if test="@rpttype = 'Cd' or @rpttype = 'Cb'">
                
            <p class="title">
                <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
            </p>
                
            <table class="table">
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Registration No.</th>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:ic_lcno"/>
                        </xsl:call-template>
                        
                        <xsl:if test="r:ic_lcno[@match = '1']">
                            (REGISTRATION MATCH)
                        </xsl:if>
                        
                        <xsl:if test="r:ic_lcno[@match = '0']">
                            (NAME MATCH)
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption" rowspan="4">Remark</th>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark1"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark2"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark3"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark4"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="long-content">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>
            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish internal_list_Cd -->
   
    <!-- start internal_list_Id -->
    <xsl:template name="internal_list_Id_template">
        
        <xsl:if test="@rpttype = 'Id' or @rpttype = 'Ib'">
                
            <p class="title">
                <xsl:value-of select="@seq"/>. <xsl:value-of select="r:title"/>
            </p>
                
            <table class="table">
                <tr>
                    <th class="caption">Name</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:name"/>
                        </xsl:call-template>
                        <xsl:if test="r:alias != ''">
                            @ <xsl:value-of select="r:alias"/>
                        </xsl:if>
                    </td>
                </tr>
                <tr>
                    <th class="caption">New ID</th>
                    <td class="short-content">
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
                    
                    <th class="caption">Old ID</th>
                    <td class="short-content">
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
                <tr>
                    <th class="caption" rowspan="4">Remark</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark1"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark2"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark3"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:remark4"/>
                        </xsl:call-template>
                    </td>
                </tr>
                <tr>
                    <th class="caption">Amount</th>
                    <td class="long-content" colspan="3">
                        <xsl:call-template name="check_empty_string">
                            <xsl:with-param name="value" select="r:amount"/>
                        </xsl:call-template>
                    </td>
                </tr>
            </table>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish internal_list_Id -->
   
</xsl:stylesheet>
