<?xml version="1.0" encoding="UTF-8"?>

<!--
    Document   : kyc_screening_report.xsl
    Created on : December 3, 2019, 4:07 PM
    Author     : ANAS
    Description:
        Purpose of transformation follows.
-->

<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/kyc"
                exclude-result-prefixes="xsl r">
    
    <xsl:template match="r:kyc_search_response">
        
        <html>
            <head>
                <title>
                    KYC Screening REPORT
                </title>
                <style type="text/css">
                    <xsl:call-template name="css_template"/>
                </style>
            </head>
            <body>
                
                <!-- search report -->
                <xsl:apply-templates select="r:kyc_search"/>
                
                <!-- external internal list report -->
                <xsl:apply-templates select="r:eil_report"/>
                
            </body>
        </html>
        
    </xsl:template>
    
    <!-- start search report -->
    <xsl:template match="r:kyc_search">
        <xsl:call-template name="kyc_screening_header_template"/>
        <!--<xsl:call-template name="summary_template"/>-->
        <xsl:apply-templates select="r:results"/>
        
        <br/>
        
        <p class="info-no-style text-center">
            <b>- End of Report -</b>
        </p>
        
        <br/>
        <xsl:call-template name="kyc_screening_footer_template"/>
        <br/>
        
    </xsl:template>
    <!-- finish search report -->
    
    <!-- start section report -->
    <xsl:template match="r:results">
        <xsl:call-template name="kyc_section_a_template"/>
        <xsl:call-template name="kyc_section_b_template" />
        <xsl:call-template name="historical_enquiry_template"/>
    </xsl:template>
    <!-- finish section report -->
    
    <!-- start internal list report -->    
    <xsl:template match="r:eil_report">
        <xsl:call-template name="internal_list_template"/>
    </xsl:template>
    <!-- finish internal list report -->
    
    <!-- start include stylesheet -->
    <!-- normal -->
    <xsl:include href="subreport/header_kyc_subreport.xsl"/>
    <xsl:include href="subreport/footer_kyc_subreport.xsl"/>
    <!-- standard -->
    <!-- <xsl:include href="subreport/section_a_subreport.xsl"/> -->
    <xsl:include href="subreport/section_a_kyc_subreport.xsl"/>
    <xsl:include href="subreport/section_b_kyc_subreport.xsl"/>
    <!-- <xsl:include href="subreport/section_b_subreport.xsl"/>
    <xsl:include href="subreport/section_c_subreport.xsl"/>
    <xsl:include href="subreport/section_d_subreport.xsl"/>
    <xsl:include href="subreport/section_e_subreport.xsl"/> -->
    <xsl:include href="subreport/historical_enquiry_subreport.xsl"/>
    <!-- internal_list -->
    <xsl:include href="subreport/internal_list_report.xsl"/>
    <!-- base -->
    <!-- <xsl:include href="subreport/base_subreport.xsl"/> -->
    <!-- base kyc -->
    <xsl:include href="subreport/base_kyc_subreport.xsl"/>
    <!-- finish include stylesheet -->
    
</xsl:stylesheet>