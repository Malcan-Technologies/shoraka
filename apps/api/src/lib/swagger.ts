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
            investor_account: { type: "array", items: { type: "string" } },
            issuer_account: { type: "array", items: { type: "string" } },
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
            eventType: {
              type: "string",
              enum: ["USER_SIGNED_UP", "USER_LOGGED_IN", "USER_LOGGED_OUT"],
            },
            occurredAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            userId: { type: "string", nullable: true },
            actor: { type: "object" },
            target: { type: "object" },
            source: { type: "string" },
            portal: { type: "string", nullable: true },
            ipAddress: { type: "string", nullable: true },
            userAgent: { type: "string", nullable: true },
            deviceInfo: { type: "string", nullable: true },
            correlationId: { type: "string", nullable: true },
            metadata: { type: "object" },
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
  apis: ["./src/modules/**/*.ts", "./src/routes.ts", "./src/app/**/*.ts"], // Files containing annotations
};

export const swaggerSpec = swaggerJsdoc.default(options);

