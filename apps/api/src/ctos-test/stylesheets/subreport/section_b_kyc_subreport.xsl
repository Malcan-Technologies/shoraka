<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:r="http://ws.cmctos.com.my/ctosnet/kyc" version="1.0">

	<!-- start kyc_section_b_template -->
	<xsl:template name="kyc_section_b_template">
		<br />

		<xsl:call-template
			name="section_b_match_details_template" />

	</xsl:template>
	<!-- finish kyc_section_b_template -->

	<!-- start section_b_match_details_template -->
	<xsl:template name="section_b_match_details_template">

		<p class="title">
			MATCH DETAILS
		</p>

		<xsl:call-template
			name="section_b_match_details_table_template" />
	</xsl:template>
	<!-- finish section_b_match_details_template -->
	
	<!-- start section_b_match_details_table_template -->
	<xsl:template
		name="section_b_match_details_table_template">

		<xsl:choose>

			<xsl:when test="@total_records != ''">

				<xsl:for-each select="r:result/r:details/r:detail">
					
					<table id='section_b_match_details_table_template'
						class="table">
						
						<xsl:variable name="position" select="position()"/>
						<xsl:variable name="dotted" select="'. '"/>
						<xsl:variable name="category" select="r:category"/>
						<xsl:variable name="nonapplicable" select="'N/A'" />

						<p class="title">
							<xsl:value-of select="$position" />
							<xsl:value-of select="$dotted" />
							<xsl:value-of select="r:name" />
						</p>
                                                <xsl:choose>
                                                    <xsl:when test="r:name_score != ''">
                                                        <tr>
                                                                <th class="caption-left-match-details">Name Score</th>
                                                                <td class="long-content-left-match-details">
                                                                        <xsl:choose>
                                                                                <xsl:when test="r:name_score != ''">
                                                                                        <xsl:value-of select="r:name_score" />
                                                                                </xsl:when>
                                                                                <xsl:when test="r:name_score = ''">
                                                                                        <xsl:value-of select="$nonapplicable" />
                                                                                </xsl:when>
                                                                        </xsl:choose>
                                                                </td>
                                                        </tr>
                                                    </xsl:when>
                                                </xsl:choose>
						<tr>
							<th class="caption-left-match-details">Category</th>
										<xsl:choose>
											<xsl:when test="$category = 'Sanction List'">
												<td  class="long-content-left-match-details">
													<span class="badge-md-sanctionlist">
														<xsl:value-of select="$category" />
													</span>
												</td>
											</xsl:when>
											<xsl:when test="$category = 'Enforcement'">
												<td class="long-content-left-match-details">
													<span class="badge-md-enforcement">
														<xsl:value-of select="$category" />
													</span>
												</td>
											</xsl:when>
											<xsl:when test="$category = 'PEP'">
												<td class="long-content-left-match-details">
													<span class="badge-md-pep">
														<xsl:value-of select="$category" />
													</span>
												</td>
											</xsl:when>
											<xsl:when test="$category = 'Adverse Media'">
												<td class="long-content-left-match-details">
													<span class="badge-md-adversemedia">
														<xsl:value-of select="$category" />
													</span>
												</td>
											</xsl:when>	
										</xsl:choose>
						</tr>
						<tr>
							<th class="caption-left-match-details">Subcategory</th>
							<td class="long-content-left-match-details">
								<!-- <xsl:call-template name="check_empty_string">
									<xsl:with-param name="value" select="r:subcategory" />
								</xsl:call-template> -->
								<xsl:choose>
									<xsl:when test="r:subcategory != ''">
										<xsl:value-of select="r:subcategory" />
									</xsl:when>
									<xsl:when test="r:subcategory = ''">
										<xsl:value-of select="$nonapplicable" />
									</xsl:when>
								</xsl:choose>
							</td>
						</tr>
						<tr>
							<th class="caption-left-match-details">Description</th>
							<td class="long-content-left-match-details">
								<xsl:call-template name="check_empty_string">
									<xsl:with-param name="value" select="r:description" />
								</xsl:call-template>
							</td>
						</tr>
						<tr>
							<th class="caption-left-match-details">Aliases</th>
							<td class="long-content-left-match-details">
								<xsl:choose>
									<xsl:when test="r:aliases[@total_records != '0']">
										<ol class="long-ol-content-left">
											<xsl:for-each select="r:aliases/r:alias">
												<li>
													<xsl:value-of select="." />
												</li>
											</xsl:for-each>
										</ol>
									</xsl:when>
									<xsl:when test="r:aliases[@total_records = '0']">
										<xsl:value-of select="$nonapplicable" />
									</xsl:when>
								</xsl:choose>
							</td>
						</tr>
						<tr>
							<th class="caption-left-match-details">ID</th>
							<td class="long-content-left-match-details">
								<xsl:choose>
									<xsl:when test="r:proprietary_id != ''">
										<xsl:value-of select="r:proprietary_id" />
									</xsl:when>
									<xsl:when test="r:proprietary_id = ''">
										<xsl:value-of select="$nonapplicable" />
									</xsl:when>
								</xsl:choose>
							</td>
						</tr>
						<tr>
							<th class="caption-left-match-details">Addresses</th>
								<xsl:choose>
									<xsl:when test="r:address != ''">
										<td class="long-content-left-match-details">
											<div style="padding-left: 23px; margin-bottom: 10px;">
												<xsl:call-template name="vertibar_seperator_newline">
		            								<xsl:with-param name="text" select="r:address"/>
		        								</xsl:call-template>
	        								</div>
	        							</td>
									</xsl:when>
									<xsl:when test="r:address = ''">
										<td class="long-content-left-match-details">
											<xsl:value-of select="$nonapplicable" />
										</td>
									</xsl:when>
								</xsl:choose>
						</tr>
						<tr>
							<th class="caption-left-match-details">Date of Birth</th>
							<td class="long-content-left-match-details">
								<xsl:choose>
									<xsl:when test="r:birth_date != ''">
										<xsl:value-of select="r:birth_date" />
									</xsl:when>
									<xsl:when test="r:birth_date = ''">
										<xsl:value-of select="$nonapplicable" />
									</xsl:when>
								</xsl:choose>
							</td>
						</tr>
						<tr>
							<th class="caption-left-match-details">Place of Birth</th>
							<td class="long-content-left-match-details">
								<xsl:choose>
									<xsl:when test="r:birth_place != ''">
										<xsl:value-of select="r:birth_place" />
									</xsl:when>
									<xsl:when test="r:birth_place = ''">
										<xsl:value-of select="$nonapplicable" />
									</xsl:when>
								</xsl:choose>
							</td>
						</tr>
						<tr>
							<th class="caption-left-match-details">Source Link</th>
							<td class="long-content-left-match-details">
									<xsl:choose>
										<xsl:when test="r:source_link != ''">
											<ol class="long-ol-content-left">
											<xsl:call-template name="vertibar_seperator_newline_source_link">
	            								<xsl:with-param name="text" select="r:source_link"/>
	        								</xsl:call-template>
	        								</ol>
										</xsl:when>
										<xsl:when test="r:source_link = ''">
											<xsl:value-of select="$nonapplicable" />
										</xsl:when>
									</xsl:choose>
							</td>
						</tr>
					</table>
				</xsl:for-each>

			</xsl:when>

			<xsl:when test="@total_records = ''">

				<p class="info">No Information Available</p>

			</xsl:when>

		</xsl:choose>

	</xsl:template>
	<!-- finish section_b_match_details_table_template -->

</xsl:stylesheet>
