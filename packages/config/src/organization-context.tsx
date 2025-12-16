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
export type OnboardingStatus = "PENDING" | "COMPLETED";
export type OrganizationMemberRole = "OWNER" | "DIRECTOR" | "MEMBER";
export type PortalType = "investor" | "issuer";

export interface OrganizationMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrganizationMemberRole;
}

export interface Organization {
  id: string;
  type: OrganizationType;
  name: string | null;
  registrationNumber: string | null;
  onboardingStatus: OnboardingStatus;
  onboardedAt: string | null;
  isOwner: boolean;
  members: OrganizationMember[];
  createdAt: string;
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
  isOnboarded: boolean;
  portalType: PortalType;
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
export function OrganizationProvider({
  children,
  portalType,
  apiUrl,
}: OrganizationProviderProps) {
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
   * Check if the active organization is onboarded
   */
  const isOnboarded = useMemo(() => {
    return activeOrganization?.onboardingStatus === "COMPLETED";
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
        isOnboarded,
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

