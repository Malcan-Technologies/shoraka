"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useMemo,
} from "react";
import { createApiClient } from "./api-client";
import { useAuthToken } from "./auth-context";

export type OrganizationType = "PERSONAL" | "COMPANY";
export type OnboardingStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "PENDING_APPROVAL"
  | "PENDING_AML"
  | "PENDING_SSM_REVIEW"
  | "PENDING_FINAL_APPROVAL"
  | "COMPLETED"
  | "REJECTED";
export type OrganizationMemberRole = "OWNER" | "DIRECTOR" | "MEMBER";
export type PortalType = "investor" | "issuer";

export interface OrganizationMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrganizationMemberRole;
}

// Bank account details - matches RegTank format
export interface BankAccountField {
  cn: boolean;
  fieldName: string;
  fieldType: string;
  fieldValue: string;
}

export interface BankAccountDetails {
  content: BankAccountField[];
  displayArea: string;
}


export interface Organization {
  id: string;
  type: OrganizationType;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName?: string | null;
  registrationNumber: string | null;
  onboardingStatus: OnboardingStatus;
  onboardedAt: string | null;
  isOwner: boolean;
  members: OrganizationMember[];
  regtankOnboardingStatus?: string | null;
  regtankVerifyLink?: string | null;
  createdAt: string;
  // KYC-verified fields (read-only)
  nationality?: string | null;
  country?: string | null;
  idIssuingCountry?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  // Editable profile fields
  phoneNumber?: string | null;
  address?: string | null;
  bankAccountDetails?: BankAccountDetails | null;
  // Approval workflow flags
  onboardingApproved?: boolean;
  amlApproved?: boolean;
  tncAccepted?: boolean;
  // Investor-specific flags
  depositReceived?: boolean;
  ssmApproved?: boolean;
  isSophisticatedInvestor?: boolean;
  // Issuer-specific flags
  ssmChecked?: boolean;
}

interface OrganizationContextType {
  activeOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  hasPersonalOrganization: boolean;
  switchOrganization: (organizationId: string) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (input: CreateOrganizationInput) => Promise<Organization>;
  completeOnboarding: (organizationId: string) => Promise<void>;
  startRegTankOnboarding: (organizationId: string) => Promise<{
    verifyLink: string;
    requestId: string;
    expiresIn: number;
    organizationType: string;
  }>;
  startIndividualOnboarding: (organizationId: string) => Promise<{
    verifyLink: string;
    requestId: string;
    expiresIn: number;
    organizationType: string;
  }>;
  startCorporateOnboarding: (
    organizationId: string,
    companyName: string
  ) => Promise<{
    verifyLink: string;
    requestId: string;
    expiresIn: number;
    organizationType: string;
  }>;
  syncRegTankStatus: (
    organizationId: string
  ) => Promise<{ status: string; substatus?: string; requestId: string; synced: boolean }>;
  setOnboardingSettings: (settings: {
    formId: number;
    livenessConfidence: number;
    approveMode: boolean;
    kycApprovalTarget?: string;
    enabledRegistrationEmail?: boolean;
    redirectUrl?: string;
  }) => Promise<void>;
  acceptTnc: (organizationId: string) => Promise<{ success: boolean; tncAccepted: boolean }>;
  updateOrganizationProfile: (
    organizationId: string,
    input: UpdateOrganizationProfileInput
  ) => Promise<{ success: boolean }>;
  isOnboarded: boolean;
  isPendingApproval: boolean;
  portalType: PortalType;
}

export interface UpdateOrganizationProfileInput {
  phoneNumber?: string | null;
  address?: string | null;
  bankAccountDetails?: BankAccountDetails | null;
}

export interface CreateOrganizationInput {
  type: "PERSONAL" | "COMPANY";
  name?: string;
  registrationNumber?: string;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const ACTIVE_ORG_KEY_PREFIX = "cashsouk_active_org_";

interface OrganizationProviderProps {
  children: ReactNode;
  portalType: PortalType;
  apiUrl: string;
}

/**
 * OrganizationProvider component that manages organization state
 * Each portal (investor/issuer) has its own organization context
 */
export function OrganizationProvider({ children, portalType, apiUrl }: OrganizationProviderProps) {
  const { getAccessToken, isAuthenticated } = useAuthToken();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [hasPersonalOrganization, setHasPersonalOrganization] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = `${ACTIVE_ORG_KEY_PREFIX}${portalType}`;
  // Track if initial fetch has completed
  const [hasFetched, setHasFetched] = useState(false);

  /**
   * Find the active organization from the list
   */
  const activeOrganization = useMemo(() => {
    if (!activeOrganizationId || organizations.length === 0) return null;
    return organizations.find((org) => org.id === activeOrganizationId) || null;
  }, [activeOrganizationId, organizations]);

  /**
   * Check if the active organization is onboarded (COMPLETED status)
   */
  const isOnboarded = useMemo(() => {
    return activeOrganization?.onboardingStatus === "COMPLETED";
  }, [activeOrganization]);

  /**
   * Check if the active organization is pending approval (awaiting admin review)
   * These statuses should allow dashboard access but with limited features
   */
  const isPendingApproval = useMemo(() => {
    const status = activeOrganization?.onboardingStatus;
    return (
      status === "PENDING_APPROVAL" ||
      status === "PENDING_AML" ||
      status === "PENDING_SSM_REVIEW" ||
      status === "PENDING_FINAL_APPROVAL"
    );
  }, [activeOrganization]);

  /**
   * Compute true loading state - we're loading if:
   * 1. We haven't fetched yet, OR
   * 2. We're in the middle of a fetch, OR
   * 3. We have organizations but activeOrganization hasn't been computed yet
   */
  const trueIsLoading = useMemo(() => {
    if (!hasFetched) return true;
    if (isLoading) return true;
    // If we have organizations but no active one selected yet, still loading
    if (organizations.length > 0 && !activeOrganization && activeOrganizationId) return true;
    return false;
  }, [hasFetched, isLoading, organizations.length, activeOrganization, activeOrganizationId]);

  /**
   * Fetch organizations from API
   */
  const refreshOrganizations = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.get<{
        organizations: Organization[];
        hasPersonalOrganization: boolean;
      }>(`/v1/organizations/${portalType}`);

      if (result.success && result.data) {
        setOrganizations(result.data.organizations);
        setHasPersonalOrganization(result.data.hasPersonalOrganization);

        // If we have organizations but no active one, select the first onboarded or first available
        if (result.data.organizations.length > 0) {
          const savedOrgId = localStorage.getItem(storageKey);
          const savedOrg = savedOrgId
            ? result.data.organizations.find((org) => org.id === savedOrgId)
            : null;

          if (savedOrg) {
            setActiveOrganizationId(savedOrg.id);
          } else {
            // Select first onboarded org, or first org if none are onboarded
            const onboardedOrg = result.data.organizations.find(
              (org) => org.onboardingStatus === "COMPLETED"
            );
            const firstOrg = onboardedOrg || result.data.organizations[0];
            setActiveOrganizationId(firstOrg.id);
            localStorage.setItem(storageKey, firstOrg.id);
          }
        } else {
          setActiveOrganizationId(null);
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error("[OrganizationProvider] Failed to fetch organizations:", error);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [isAuthenticated, apiUrl, getAccessToken, portalType, storageKey]);

  /**
   * Fetch organizations on mount and when authentication changes
   */
  useEffect(() => {
    if (isAuthenticated !== null) {
      refreshOrganizations();
    }
  }, [isAuthenticated, refreshOrganizations]);

  /**
   * Switch to a different organization
   */
  const switchOrganization = useCallback(
    (organizationId: string) => {
      const org = organizations.find((o) => o.id === organizationId);
      if (org) {
        setActiveOrganizationId(organizationId);
        localStorage.setItem(storageKey, organizationId);
      }
    },
    [organizations, storageKey]
  );

  /**
   * Create a new organization
   */
  const createOrganization = useCallback(
    async (input: CreateOrganizationInput): Promise<Organization> => {
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.post<{
        id: string;
        type: OrganizationType;
        name: string | null;
        registrationNumber: string | null;
        onboardingStatus: OnboardingStatus;
        createdAt: string;
      }>(`/v1/organizations/${portalType}`, input);

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create organization");
      }

      // Create a full organization object for the new org
      const newOrg: Organization = {
        id: result.data.id,
        type: result.data.type,
        name: result.data.name,
        firstName: null, // Will be populated from RegTank data after onboarding
        lastName: null,
        registrationNumber: result.data.registrationNumber,
        onboardingStatus: result.data.onboardingStatus,
        onboardedAt: null,
        isOwner: true,
        members: [],
        createdAt: result.data.createdAt,
      };

      // Add to local state and set as active
      setOrganizations((prev) => [...prev, newOrg]);
      setActiveOrganizationId(newOrg.id);
      localStorage.setItem(storageKey, newOrg.id);

      // Update hasPersonalOrganization if needed
      if (input.type === "PERSONAL") {
        setHasPersonalOrganization(true);
      }

      return newOrg;
    },
    [apiUrl, getAccessToken, portalType, storageKey]
  );

  /**
   * Complete onboarding for an organization
   */
  const completeOnboarding = useCallback(
    async (organizationId: string): Promise<void> => {
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.post<{
        id: string;
        onboardingStatus: OnboardingStatus;
        onboardedAt: string;
      }>(`/v1/organizations/${portalType}/${organizationId}/complete-onboarding`, {});

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to complete onboarding");
      }

      // Update local state
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === organizationId
            ? {
                ...org,
                onboardingStatus: result.data.onboardingStatus,
                onboardedAt: result.data.onboardedAt,
              }
            : org
        )
      );
    },
    [apiUrl, getAccessToken, portalType]
  );

  /**
   * Start RegTank onboarding for an organization (legacy endpoint)
   * Returns the verify link to redirect user to RegTank portal
   * @deprecated Use startIndividualOnboarding or startCorporateOnboarding instead
   */
  const startRegTankOnboarding = useCallback(
    async (
      organizationId: string
    ): Promise<{
      verifyLink: string;
      requestId: string;
      expiresIn: number;
      organizationType: string;
    }> => {
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.post<{
        verifyLink: string;
        requestId: string;
        expiresIn: number;
        organizationType: string;
      }>("/v1/regtank/start-onboarding", {
        organizationId,
        portalType,
      });

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to start RegTank onboarding");
      }

      return result.data;
    },
    [apiUrl, getAccessToken, portalType]
  );

  /**
   * Start RegTank individual onboarding for an organization
   * Returns the verify link to redirect user to RegTank portal
   */
  const startIndividualOnboarding = useCallback(
    async (
      organizationId: string
    ): Promise<{
      verifyLink: string;
      requestId: string;
      expiresIn: number;
      organizationType: string;
    }> => {
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.post<{
        verifyLink: string;
        requestId: string;
        expiresIn: number;
        organizationType: string;
      }>("/v1/regtank/start-individual-onboarding", {
        organizationId,
        portalType,
      });

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to start individual onboarding");
      }

      return result.data;
    },
    [apiUrl, getAccessToken, portalType]
  );

  /**
   * Start RegTank corporate onboarding for an organization
   * Returns the verify link to redirect user to RegTank portal
   */
  const startCorporateOnboarding = useCallback(
    async (
      organizationId: string,
      companyName: string
    ): Promise<{
      verifyLink: string;
      requestId: string;
      expiresIn: number;
      organizationType: string;
    }> => {
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.post<{
        verifyLink: string;
        requestId: string;
        expiresIn: number;
        organizationType: string;
      }>("/v1/regtank/start-corporate-onboarding", {
        organizationId,
        portalType,
        companyName,
      });

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to start corporate onboarding");
      }

      return result.data;
    },
    [apiUrl, getAccessToken, portalType]
  );

  /**
   * Manually sync RegTank onboarding status from RegTank API
   * Useful when webhooks are delayed or not configured
   */
  const syncRegTankStatus = useCallback(
    async (
      organizationId: string
    ): Promise<{ status: string; substatus?: string; requestId: string; synced: boolean }> => {
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.post<{
        status: string;
        substatus?: string;
        requestId: string;
        synced: boolean;
      }>(`/v1/regtank/sync-status/${organizationId}?portalType=${portalType}`, {});

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to sync RegTank status");
      }

      // Refresh organizations after sync to get updated status
      await refreshOrganizations();

      return result.data;
    },
    [apiUrl, getAccessToken, portalType, refreshOrganizations]
  );

  /**
   * Set RegTank onboarding settings (redirectUrl, livenessConfidence, etc.)
   * Should be called before starting onboarding to configure portal-specific redirect URL
   */
  const setOnboardingSettings = useCallback(
    async (settings: {
      formId: number;
      livenessConfidence: number;
      approveMode: boolean;
      kycApprovalTarget?: string;
      enabledRegistrationEmail?: boolean;
      redirectUrl?: string;
    }): Promise<void> => {
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.post<{ message: string }>(
        "/v1/regtank/set-onboarding-settings",
        settings
      );

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to set onboarding settings");
      }
    },
    [apiUrl, getAccessToken]
  );

  /**
   * Accept Terms and Conditions for an organization
   */
  const acceptTnc = useCallback(
    async (organizationId: string): Promise<{ success: boolean; tncAccepted: boolean }> => {
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.post<{ success: boolean; tncAccepted: boolean }>(
        `/v1/organizations/${portalType}/${organizationId}/accept-tnc`,
        {}
      );

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to accept Terms and Conditions");
      }

      // Update local state
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === organizationId
            ? {
                ...org,
                tncAccepted: result.data.tncAccepted,
              }
            : org
        )
      );

      return result.data;
    },
    [apiUrl, getAccessToken, portalType]
  );

  /**
   * Update organization profile (editable fields only)
   */
  const updateOrganizationProfile = useCallback(
    async (
      organizationId: string,
      input: UpdateOrganizationProfileInput
    ): Promise<{ success: boolean }> => {
      const apiClient = createApiClient(apiUrl, getAccessToken);
      const result = await apiClient.patch<{ success: boolean }>(
        `/v1/organizations/${portalType}/${organizationId}`,
        input
      );

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update organization profile");
      }

      // Update local state with the new values
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === organizationId
            ? {
                ...org,
                phoneNumber: input.phoneNumber !== undefined ? input.phoneNumber : org.phoneNumber,
                address: input.address !== undefined ? input.address : org.address,
                bankAccountDetails:
                  input.bankAccountDetails !== undefined
                    ? input.bankAccountDetails
                    : org.bankAccountDetails,
              }
            : org
        )
      );

      return result.data;
    },
    [apiUrl, getAccessToken, portalType]
  );

  return (
    <OrganizationContext.Provider
      value={{
        activeOrganization,
        organizations,
        isLoading: trueIsLoading,
        hasPersonalOrganization,
        switchOrganization,
        refreshOrganizations,
        createOrganization,
        completeOnboarding,
        startRegTankOnboarding,
        startIndividualOnboarding,
        startCorporateOnboarding,
        syncRegTankStatus,
        setOnboardingSettings,
        acceptTnc,
        updateOrganizationProfile,
        isOnboarded,
        isPendingApproval,
        portalType,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

/**
 * Hook to access organization context
 */
export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}
