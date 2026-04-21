<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/response"
                exclude-result-prefixes="xsl r">
    
    <!-- start historical_enquiry -->
    <xsl:template name="historical_enquiry_template">
        
        <xsl:if test="r:section_b[@data = 'true']/r:history[@rpttype = 'EH']">
            
            <p class="title">
                HISTORICAL ENQUIRY
            </p>
            
            <xsl:variable name="current_year">
                <xsl:value-of select="substring(//r:header/r:enq_date, 1, 4)"/>
            </xsl:variable>
            
            <xsl:variable name="current_month">
            	<xsl:choose>
            	<xsl:when test="substring(//r:header/r:enq_date, 6, 2) != '10'">
            		<xsl:value-of select="translate(substring(//r:header/r:enq_date, 6, 2), '0', '')"/>
            	</xsl:when>
                <xsl:otherwise>
                	<xsl:value-of select="substring(//r:header/r:enq_date, 6, 2)"/>
                </xsl:otherwise>
                </xsl:choose>
            </xsl:variable>
            
            <xsl:for-each select="r:section_b/r:history[@rpttype = 'EH']">
                <xsl:variable name="year">
                	<xsl:value-of select="@year"></xsl:value-of>
                </xsl:variable>
                <table class="table-text-center">
                    <tr>
                    	<td class="title" rowspan="5">
                            <xsl:value-of select="$year"/>
                        </td>
                        <td class="header">Month</td>
                        <xsl:for-each select="r:period">
                        <xsl:choose>
                            <xsl:when test="$year = $current_year and @month = $current_month">              
                                <td class="sub-header">
                                    <xsl:call-template name="month_abbreviation_template">
                                        <xsl:with-param name="month" select="@month"/>
                                    </xsl:call-template>
                                </td>
                            </xsl:when>
                            <xsl:when test="$year != $current_year or @month != $current_month">                 
                                <td class="sub-header">
                                    <xsl:call-template name="month_abbreviation_template">
                                        <xsl:with-param name="month" select="@month"/>
                                    </xsl:call-template>
                                </td>  
                            </xsl:when>
                        </xsl:choose>
                        </xsl:for-each>
                    </tr>
                    <tr>
                        <th class="caption">FI</th>
                        <xsl:for-each select="r:period">
                        <xsl:choose>
                            <xsl:when test="$year = $current_year and @month = $current_month">              
                                <td class="sub-header">
                                    <xsl:value-of select="r:entity[@type = 'FI']/@value"/>
                                </td>
                            </xsl:when>
                            <xsl:when test="$year != $current_year or @month != $current_month">                 
                                <td>
                                    <xsl:value-of select="r:entity[@type = 'FI']/@value"/>
                                </td>  
                            </xsl:when>
                        </xsl:choose>
                        </xsl:for-each>
                    </tr>
                    <tr>
                        <th class="caption">Non-FI</th>
                        <xsl:for-each select="r:period">
                        <xsl:choose>
                            <xsl:when test="$year = $current_year and @month = $current_month">              
                                <td class="sub-header">
                                    <xsl:value-of select="r:entity[@type = 'NON-FI']/@value"/>
                                </td>
                            </xsl:when>
                            <xsl:when test="$year != $current_year or @month != $current_month">                 
                                <td>
                                    <xsl:value-of select="r:entity[@type = 'NON-FI']/@value"/>
                                </td>  
                            </xsl:when>
                        </xsl:choose>
                        </xsl:for-each>
                    </tr>
                    <tr>
                        <th class="caption">Lawyer</th>
                        <xsl:for-each select="r:period">
                        <xsl:choose>
                            <xsl:when test="$year = $current_year and @month = $current_month">              
                                <td class="sub-header">
                                    <xsl:value-of select="r:entity[@type = 'LAWYER']/@value"/>
                                </td>
                            </xsl:when>
                            <xsl:when test="$year != $current_year or @month != $current_month">                 
                                <td>
                                    <xsl:value-of select="r:entity[@type = 'LAWYER']/@value"/>
                                </td>  
                            </xsl:when>
                        </xsl:choose>
                        </xsl:for-each>
                    </tr>
                    <tr>
                        <th class="caption">Total</th>
                        <xsl:for-each select="r:period">
                        <xsl:choose>
                            <xsl:when test="$year = $current_year and @month = $current_month">              
                                <td class="sub-header">
                                    <xsl:value-of select="r:entity[@type = 'FI']/@value + r:entity[@type = 'NON-FI']/@value + r:entity[@type = 'LAWYER']/@value"/>
                                </td>
                            </xsl:when>
                            <xsl:when test="$year != $current_year or @month != $current_month">                 
                                <td>
                                    <xsl:value-of select="r:entity[@type = 'FI']/@value + r:entity[@type = 'NON-FI']/@value + r:entity[@type = 'LAWYER']/@value"/>
                                </td>  
                            </xsl:when>
                        </xsl:choose>
                        </xsl:for-each>
                    </tr>
                </table>
               
            </xsl:for-each>
            
            <br/>
            
        </xsl:if>
        
    </xsl:template>
    <!-- finish historical_enquiry -->    

</xsl:stylesheet>
