<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/response"
                exclude-result-prefixes="xsl r">
    
    <xsl:template match="r:report">
        
        <html>
            <head>
                <title>
                    CTOS SCORE REPORT
                </title>
                <style type="text/css">
                    <xsl:call-template name="css_template"/>
                </style>
            </head>
            <body>
                
                <!-- enquiry report -->
                <xsl:apply-templates select="r:enq_report"/>
                
                <!-- external internal list report -->
                <xsl:apply-templates select="r:eil_report"/>
                
            </body>
        </html>
        
    </xsl:template>
    
    <!-- start enquiry report -->
    <xsl:template match="r:enq_report">
        <xsl:call-template name="fico_header_template"/>
        <!--<xsl:call-template name="summary_template"/>-->
        <xsl:apply-templates select="r:enquiry"/>
        <xsl:call-template name="ctos_footer_template"/>
        
        <br/>
        <p class="info-no-style text-center">
            <b>- End of Report -</b>
        </p>
        <br/>
        
    </xsl:template>
    <!-- finish start enquiry report -->
    
    <!-- start section report -->
    <xsl:template match="r:enquiry">
        <!--<xsl:call-template name="ctos_section_enquiry_template"/>-->
        <xsl:call-template name="fico_section_a_template"/>
        <xsl:call-template name="section_b_template"/>
        <xsl:call-template name="section_c1_template"/> 
        <xsl:call-template name="section_c2_template"/> 
        <xsl:call-template name="section_c3_template_angkasa"/>
        <xsl:call-template name="section_d1_summary_template"/>
        <xsl:call-template name="section_d1_template"/>
        <xsl:call-template name="section_d2_template"/>
        <xsl:call-template name="section_d3_template"/>
        <xsl:call-template name="section_d4_template"/>
        <xsl:call-template name="section_e_template"/>
        <xsl:call-template name="historical_enquiry_template"/>
        <xsl:call-template name="report_legend_template"/>
    </xsl:template>
    <!-- finish section report -->
    
    <!-- start internal list report -->    
    <xsl:template match="r:eil_report">
        <xsl:call-template name="internal_list_template"/>
    </xsl:template>
    <!-- finish internal list report -->
    
    <!-- start include stylesheet -->
    <!-- normal -->
    <xsl:include href="subreport/header_subreport.xsl"/>
    <xsl:include href="subreport/footer_subreport.xsl"/>
    <!-- standard -->
    <xsl:include href="subreport/section_a_subreport.xsl"/>
    <xsl:include href="subreport/section_b_subreport.xsl"/>
    <xsl:include href="subreport/section_c_subreport.xsl"/>
    <xsl:include href="subreport/section_d_subreport.xsl"/>
    <xsl:include href="subreport/section_e_subreport.xsl"/>
    <xsl:include href="subreport/historical_enquiry_subreport.xsl"/>
    <!-- internal_list -->
    <xsl:include href="subreport/internal_list_report.xsl"/>
    <!-- base -->
    <xsl:include href="subreport/base_subreport.xsl"/>
    <!-- finish include stylesheet -->
    
</xsl:stylesheet>