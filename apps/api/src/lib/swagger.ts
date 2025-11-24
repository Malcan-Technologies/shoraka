import * as swaggerJsdoc from "swagger-jsdoc";
import { UserRole } from "@prisma/client";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CashSouk P2P Lending API",
      version: "1.0.0",
      description: "API documentation for CashSouk P2P Lending Platform",
      contact: {
        name: "CashSouk API Support",
        email: "api@cashsouk.com",
      },
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Development server",
      },
      {
        url: "https://api.cashsouk.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Cognito ID Token or Access Token",
        },
      },
      schemas: {
        UserRole: {
          type: "string",
          enum: Object.values(UserRole),
          description: "User role in the system",
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", description: "User ID (CUID)" },
            email: { type: "string", format: "email" },
            cognito_sub: { type: "string", description: "Cognito user UUID" },
            cognito_username: { type: "string" },
            roles: {
              type: "array",
              items: { $ref: "#/components/schemas/UserRole" },
            },
            first_name: { type: "string" },
            last_name: { type: "string" },
            phone: { type: "string", nullable: true },
            email_verified: { type: "boolean" },
            kyc_verified: { type: "boolean" },
            investor_onboarding_completed: { type: "boolean" },
            issuer_onboarding_completed: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "object" },
            correlationId: { type: "string" },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: { type: "object", nullable: true },
              },
            },
            correlationId: { type: "string" },
          },
        },
        AccessLog: {
          type: "object",
          properties: {
            id: { type: "string" },
            user_id: { type: "string" },
            event_type: {
              type: "string",
              enum: ["LOGIN", "LOGOUT", "SIGNUP", "ROLE_ADDED", "ROLE_SWITCHED", "ONBOARDING_COMPLETED"],
            },
            ip_address: { type: "string", nullable: true },
            user_agent: { type: "string", nullable: true },
            device_info: { type: "string", nullable: true },
            cognito_event: { type: "object", nullable: true },
            success: { type: "boolean" },
            metadata: { type: "object", nullable: true },
            created_at: { type: "string", format: "date-time" },
          },
        },
        UserSession: {
          type: "object",
          properties: {
            id: { type: "string" },
            user_id: { type: "string" },
            cognito_session: { type: "string" },
            ip_address: { type: "string", nullable: true },
            device_info: { type: "string", nullable: true },
            active_role: { $ref: "#/components/schemas/UserRole", nullable: true },
            last_activity: { type: "string", format: "date-time" },
            expires_at: { type: "string", format: "date-time" },
            revoked_at: { type: "string", format: "date-time", nullable: true },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ["./src/modules/**/*.ts", "./src/routes.ts"], // Files containing annotations
};

export const swaggerSpec = swaggerJsdoc.default(options);

