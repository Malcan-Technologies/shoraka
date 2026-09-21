import {
  parseCookieHeader,
  parseCookiePair,
  readCognitoAccessTokenFromCookieMap,
} from "./cookie-pair";

describe("parseCookiePair", () => {
  it("keeps the full value when it contains `=`", () => {
    expect(parseCookiePair("accessToken=aaa.bbb.ccc=")).toEqual({
      name: "accessToken",
      value: "aaa.bbb.ccc=",
    });
  });
});

describe("parseCookieHeader", () => {
  it("round-trips a Cognito access token whose value contains `=`", () => {
    const clientId = "portal-client";
    const userId = "cognito-user";
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWI.padding==";
    const header = [
      `CognitoIdentityServiceProvider.${clientId}.LastAuthUser=${userId}`,
      `CognitoIdentityServiceProvider.${clientId}.${userId}.accessToken=${token}`,
    ].join("; ");

    const cookies = parseCookieHeader(header);

    expect(readCognitoAccessTokenFromCookieMap(cookies, clientId)).toBe(token);
  });
});
