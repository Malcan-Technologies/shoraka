const mockSend = jest.fn();

jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  AdminUserGlobalSignOutCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

jest.mock("../../config/aws", () => ({
  getCognitoConfig: () => ({ userPoolId: "ap-southeast-5_testpool" }),
}));

import { AdminUserGlobalSignOutCommand } from "@aws-sdk/client-cognito-identity-provider";
import { signOutCognitoUserGlobally } from "./cognito-global-signout";

describe("signOutCognitoUserGlobally", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("sends AdminUserGlobalSignOut for the Cognito username", async () => {
    mockSend.mockResolvedValue({});
    await signOutCognitoUserGlobally("cognito-sub-1");
    expect(AdminUserGlobalSignOutCommand).toHaveBeenCalledWith({
      UserPoolId: "ap-southeast-5_testpool",
      Username: "cognito-sub-1",
    });
    expect(mockSend).toHaveBeenCalled();
  });

  it("does not throw when Cognito fails", async () => {
    mockSend.mockRejectedValue(new Error("Cognito unavailable"));
    await expect(signOutCognitoUserGlobally("cognito-sub-1")).resolves.toBeUndefined();
  });
});
