import { OrganizationType } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { buildCtosEnquiryXml, buildCtosSubjectEnquiryXml } from "./enquiry-builder";
import {
  classifyCtosCaughtError,
  CTOS_AUTH_ERROR,
  CTOS_MISSING_SUBJECT_IDENTIFIER,
  CTOS_PARSE_ERROR,
  CTOS_PROVIDER_ERROR,
  CTOS_TIMEOUT,
} from "./ctos-errors";

const cfg = {
  companyCode: "c",
  accountNo: "a",
  userId: "u",
} as never;

describe("CTOS enquiry identifier errors", () => {
  it("missing company registration is typed, not an internal Error", () => {
    try {
      buildCtosEnquiryXml(cfg, {
        type: OrganizationType.COMPANY,
        name: "Acme",
        registration_number: "  ",
        first_name: null,
        last_name: null,
        document_number: null,
      });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 400,
        code: CTOS_MISSING_SUBJECT_IDENTIFIER,
      });
    }
  });

  it("blank individual document number is typed", () => {
    try {
      buildCtosEnquiryXml(cfg, {
        type: OrganizationType.PERSONAL,
        name: "Jane",
        registration_number: null,
        first_name: "Jane",
        last_name: "Doe",
        document_number: "",
      });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 400,
        code: CTOS_MISSING_SUBJECT_IDENTIFIER,
      });
    }
  });

  it("valid company SSM still builds XML", () => {
    const xml = buildCtosEnquiryXml(cfg, {
      type: OrganizationType.COMPANY,
      name: "Acme",
      registration_number: "202201012345",
      first_name: null,
      last_name: null,
      document_number: null,
    });
    expect(xml).toContain("<ic_lc>202201012345</ic_lc>");
  });

  it("missing subject identity number is typed", () => {
    try {
      buildCtosSubjectEnquiryXml(cfg, {
        kind: "INDIVIDUAL",
        displayName: "Jamie Lim",
        idNumber: "  ",
      });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: CTOS_MISSING_SUBJECT_IDENTIFIER,
      });
    }
  });
});

describe("classifyCtosCaughtError", () => {
  it("maps timeout, auth, SOAP, and parse failures", () => {
    expect(classifyCtosCaughtError(Object.assign(new Error("timed out"), { name: "TimeoutError" })).code).toBe(
      CTOS_TIMEOUT
    );
    expect(classifyCtosCaughtError(new Error("CTOS authentication failed")).code).toBe(CTOS_AUTH_ERROR);
    expect(classifyCtosCaughtError(new Error("CTOS SOAP request failed")).code).toBe(CTOS_PROVIDER_ERROR);
    expect(classifyCtosCaughtError(new Error("Invalid CTOS SOAP response (no return payload)")).code).toBe(
      CTOS_PARSE_ERROR
    );
  });

  it("does not convert an existing AppError", () => {
    const original = new AppError(400, CTOS_MISSING_SUBJECT_IDENTIFIER, "missing");
    expect(classifyCtosCaughtError(original)).toBe(original);
  });
});
