<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:r="http://ws.cmctos.com.my/ctosnet/kyc"
                version="1.0">
   
   <!-- start kyc_section_a_template --> 
   <xsl:template name="kyc_section_a_template">
        
        <table id='kyc_section_a_template'>
            <tr>
                <td class="table-left-width" valign="top">
                    
                    <xsl:call-template name="section_a_search_criteria_template"/>
                
                </td>
                <td class="table-center-width">
                	<br/>
                </td>
                <td class="table-right-width" valign="top">
                	<xsl:call-template name="section_a_number_of_matches"/>
                </td>
            </tr>
        </table>
        
    </xsl:template>
    <!-- finish kyc_section_a_template -->
    
    <!--    start section_a_search_criteria_template-->
    <xsl:template name="section_a_search_criteria_template">
        
        <p class="title">
            SEARCH CRITERIA (YOUR INPUTS)
        </p>
        
        <xsl:call-template name="section_a_search_criteria_your_inputs_template"/>
    </xsl:template>
    <!--    finish section_a_search_criteria_template-->
    
    <!-- start section_a_search_criteria_your_inputs_template -->
    <xsl:template name="section_a_search_criteria_your_inputs_template">
            
            <table class="table">
            	<xsl:choose>
            		<!-- For type equal to "Individual" -->
            		<xsl:when test="//r:input/r:type = 'I'">
            			<xsl:call-template name="section_a_search_criteria_your_inputs_sub_template"/>
            		</xsl:when>
            		<!-- For type equal to "Business" -->
            		<xsl:when test="//r:input/r:type = 'B'">
            			<xsl:call-template name="section_a_search_criteria_your_inputs_sub_template_for_business_type"/>
            		</xsl:when>
            	</xsl:choose>
            </table>
        
    </xsl:template>
    <!-- finish section_a_search_criteria_your_inputs_template -->    

    <!-- start section_a_search_criteria_your_inputs_sub_template -->
    <xsl:template name="section_a_search_criteria_your_inputs_sub_template">
        
        <xsl:variable name="type">
        	<xsl:value-of select="//r:input/r:type"/>
        </xsl:variable>
        
        <xsl:variable name="ic_no">
        	<xsl:value-of select="//r:input/r:ic_no"/>
        </xsl:variable>
        
        <xsl:variable name="passport_no">
        	<xsl:value-of select="//r:input/r:passport_no"/>
        </xsl:variable>
        
        <xsl:variable name="date_of_birth">
        	<xsl:value-of select="//r:input/r:date_of_birth"/>
        </xsl:variable>
        
        <xsl:variable name="gender">
        	<xsl:value-of select="//r:input/r:gender"/>
        </xsl:variable>
        
        <xsl:variable name="country">
        	<xsl:value-of select="//r:input/r:country"/>
        </xsl:variable>
        
        <xsl:variable name="Individual" select="'Individual'" />
        <xsl:variable name="Company" select="'Company'" />
        <xsl:variable name="NotInserted" select="'Not Inserted'" />
        
        <tr>
            <th class="caption-left">Type</th>
            <td class="long-content-left">
                    <xsl:choose>
                    	<xsl:when test="$type = 'I'">
                    		<xsl:value-of select="$Individual"/>
                    	</xsl:when>
                    	<xsl:when test="$type = 'C'">
                    		<xsl:value-of select="$Company"/>
                    	</xsl:when>
                    </xsl:choose>
            </td>
        </tr>
        <tr>
            <th class="caption-left">First Name</th>
            <td class="long-content-left">
                <xsl:call-template name="check_empty_string">
                    <xsl:with-param name="value" select="//r:input/r:first_name"/>
                </xsl:call-template>
            </td>
        </tr>
        <tr>
            <th class="caption-left">Last Name</th>
            <td class="long-content-left">
                <xsl:call-template name="check_empty_string">
                    <xsl:with-param name="value" select="//r:input/r:last_name"/>
                </xsl:call-template>
            </td>
        </tr>
        <tr>
        	<th class="caption-left">IC No.</th>
        	<td class="long-content-left">
        		<xsl:choose>
        			<xsl:when test="$ic_no != ''">
        				<xsl:value-of select="$ic_no"/>
        			</xsl:when>
        			<xsl:when test="$ic_no = ''">
        				<xsl:value-of select="$NotInserted"/>
        			</xsl:when>
        		</xsl:choose>
        	</td>
        </tr>
        <tr>
        	<th class="caption-left">Passport No.</th>
        	<td class="long-content-left">
        		<xsl:choose>
        			<xsl:when test="$passport_no != ''">
        				<xsl:value-of select="$passport_no"/>
        			</xsl:when>
        			<xsl:when test="$passport_no = ''">
        				<xsl:value-of select="$NotInserted"/>
        			</xsl:when>
        		</xsl:choose>
        	</td>
        </tr>
        <tr>
        	<th class="caption-left">Date of Birth</th>
        	<td class="long-content-left">
        		<xsl:choose>
        			<xsl:when test="$date_of_birth != ''">
        				<xsl:value-of select="$date_of_birth"/>
        			</xsl:when>
        			<xsl:when test="$date_of_birth = ''">
        				<xsl:value-of select="$NotInserted"/>
        			</xsl:when>
        		</xsl:choose>
        	</td>
        </tr>
        <tr>
        	<th class="caption-left">Gender</th>
        	<td class="long-content-left">
        		<xsl:choose>
        			<xsl:when test="$gender != ''">
        				<xsl:value-of select="$gender"/>
        			</xsl:when>
        			<xsl:when test="$gender = ''">
        				<xsl:value-of select="$NotInserted"/>
        			</xsl:when>
        		</xsl:choose>
        	</td>
        </tr>
        <tr>
        	<th class="caption-left">Country</th>
        	<td class="long-content-left">
        		<xsl:choose>
        			<xsl:when test="$country != ''">
        				<xsl:value-of select="$country"/>
        			</xsl:when>
        			<xsl:when test="$country = ''">
        				<xsl:value-of select="$NotInserted"/>
        			</xsl:when>
        		</xsl:choose>
        	</td>
        </tr>
    </xsl:template>
    <!-- finish section_a_search_criteria_your_inputs_sub_template -->
    
    <!-- start section_a_search_criteria_your_inputs_sub_template_for_business_type -->
    <xsl:template name="section_a_search_criteria_your_inputs_sub_template_for_business_type">
    
		<xsl:variable name="NotInserted" select="'Not Inserted'" />
		
		<xsl:variable name="Business" select="'Business'" />
		
		<xsl:variable name="registration_no">
			<xsl:value-of select="//r:input/r:registration_no" />
		</xsl:variable>
		
		<tr>
            <th class="caption-left">Type</th>
            <td class="long-content-left">
            	<xsl:call-template name="check_empty_string">
                    <xsl:with-param name="value" select="$Business"/>
                </xsl:call-template>
            </td>
        </tr>
        
        <tr>
            <th class="caption-left">Business Name</th>
            <td class="long-content-left">
            	<xsl:call-template name="check_empty_string">
                    <xsl:with-param name="value" select="//r:input/r:business_name"/>
                </xsl:call-template>
            </td>
        </tr>
        
        <tr>
            <th class="caption-left">Registration No.</th>
            <td class="long-content-left">
            	<xsl:choose>
        			<xsl:when test="$registration_no != ''">
        				<xsl:value-of select="$registration_no"/>
        			</xsl:when>
        			<xsl:when test="$registration_no = ''">
        				<xsl:value-of select="$NotInserted"/>
        			</xsl:when>
        		</xsl:choose>
            </td>
        </tr>
        
        <tr>
            <th class="caption-left">Country</th>
            <td class="long-content-left">
            	<xsl:call-template name="check_empty_string">
                    <xsl:with-param name="value" select="//r:input/r:country"/>
                </xsl:call-template>
            </td>
        </tr>
    </xsl:template>
    <!-- finish section_a_search_criteria_your_inputs_sub_template_for_business_type -->
    
    <!-- start section_a_number_of_matches -->
    <xsl:template name="section_a_number_of_matches">
        
        <p class="title">
            NUMBER OF MATCHES
        </p>
        
        <table id='section_a_number_of_matches' class="table-number-of-matches">
            <tr>
                <th class="caption-left-nom">Sanction List</th>
                <xsl:choose>
                	<xsl:when test="@total_records = ''">
						<td class="caption-content-right-nom">
							<span class="circle-nom-green">
								<xsl:value-of select="0" />
							</span>
						</td>
					</xsl:when>
					<xsl:when test="r:result/r:summary/r:matches/r:sanction_list != '0'">
						<td  class="caption-content-right-nom">
							<span class="circle-nom-red">
								<xsl:value-of select="r:result/r:summary/r:matches/r:sanction_list" />
							</span>
						</td>
					</xsl:when>
					<xsl:when test="r:result/r:summary/r:matches/r:sanction_list = '0'">
						<td class="caption-content-right-nom">
							<span class="circle-nom-green">
								<xsl:value-of select="r:result/r:summary/r:matches/r:sanction_list" />
							</span>
						</td>
					</xsl:when>
				</xsl:choose>
            </tr>
            <tr>
                <th class="caption-left-nom">Enforcement</th>
                <xsl:choose>
                	<xsl:when test="@total_records = ''">
						<td class="caption-content-right-nom">
							<span class="circle-nom-green">
								<xsl:value-of select="0" />
							</span>
						</td>
					</xsl:when>
					<xsl:when test="r:result/r:summary/r:matches/r:enforcement != '0'">
						<td  class="caption-content-right-nom">
							<span class="circle-nom-red">
								<xsl:value-of select="r:result/r:summary/r:matches/r:enforcement" />
							</span>
						</td>
					</xsl:when>
					<xsl:when test="r:result/r:summary/r:matches/r:enforcement = '0'">
						<td class="caption-content-right-nom">
							<span class="circle-nom-green">
								<xsl:value-of select="r:result/r:summary/r:matches/r:enforcement" />
							</span>
						</td>
					</xsl:when>
				</xsl:choose>
            </tr>
            <tr>
                <th class="caption-left-nom">PEP</th>
                <xsl:choose>
                	<xsl:when test="@total_records = ''">
						<td class="caption-content-right-nom">
							<span class="circle-nom-green">
								<xsl:value-of select="0" />
							</span>
						</td>
					</xsl:when>
					<xsl:when test="r:result/r:summary/r:matches/r:pep != '0'">
						<td  class="caption-content-right-nom">
							<span class="circle-nom-orange">
								<xsl:value-of select="r:result/r:summary/r:matches/r:pep" />
							</span>
						</td>
					</xsl:when>
					<xsl:when test="r:result/r:summary/r:matches/r:pep = '0'">
						<td class="caption-content-right-nom">
							<span class="circle-nom-green">
								<xsl:value-of select="r:result/r:summary/r:matches/r:pep" />
							</span>
						</td>
					</xsl:when>
				</xsl:choose>
            </tr>
            <tr>
            	<th class="caption-left-nom">Adverse Media</th>
            	<xsl:choose>
            		<xsl:when test="@total_records = ''">
						<td class="caption-content-right-nom">
							<span class="circle-nom-green">
								<xsl:value-of select="0" />
							</span>
						</td>
					</xsl:when>
					<xsl:when test="r:result/r:summary/r:matches/r:adverse_media != '0'">
						<td  class="caption-content-right-nom">
							<span class="circle-nom-yellow">
								<xsl:value-of select="r:result/r:summary/r:matches/r:adverse_media" />
							</span>
						</td>
					</xsl:when>
					<xsl:when test="r:result/r:summary/r:matches/r:adverse_media = '0'">
						<td class="caption-content-right-nom">
							<span class="circle-nom-green">
								<xsl:value-of select="r:result/r:summary/r:matches/r:adverse_media" />
							</span>
						</td>
					</xsl:when>
				</xsl:choose>
            </tr>            
        </table>
        
        
    </xsl:template>
    <!-- finish section_a_number_of_matches -->

</xsl:stylesheet>
