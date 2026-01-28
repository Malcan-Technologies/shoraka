import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.cashsouk.com";

/**
 * Proxy route to bypass CORS for error testing
 * This allows localhost to make requests to the production API
 */
export async function GET(request: NextRequest) {
  return handleProxyRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request, "POST");
}

export async function PUT(request: NextRequest) {
  return handleProxyRequest(request, "PUT");
}

export async function PATCH(request: NextRequest) {
  return handleProxyRequest(request, "PATCH");
}

export async function DELETE(request: NextRequest) {
  return handleProxyRequest(request, "DELETE");
}

async function handleProxyRequest(
  request: NextRequest,
  method: string
): Promise<NextResponse> {
  try {
    // Get the endpoint from query params
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing endpoint parameter" },
        { status: 400 }
      );
    }

    // Get auth token from Authorization header
    const authHeader = request.headers.get("authorization");

    // Prepare headers for the API request
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    // Forward cookies
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }

    // Prepare request options
    const options: RequestInit = {
      method,
      headers,
      credentials: "include",
    };

    // Add body for methods that need it
    if (method !== "GET" && method !== "DELETE") {
      try {
        const body = await request.json();
        options.body = JSON.stringify(body);
      } catch {
        // No body provided, use default
        options.body = JSON.stringify({ invalid: "data" });
      }
    }

    // Make the request to the actual API
    const response = await fetch(`${API_URL}${endpoint}`, options);

    // Get response data
    const responseData = await response.text();
    let jsonData;
    try {
      jsonData = responseData ? JSON.parse(responseData) : {};
    } catch {
      jsonData = { raw: responseData };
    }

    // Return the response with the actual status code from the API
    // This preserves the error status (400, 404, etc.) for testing
    return NextResponse.json(
      {
        status: response.status,
        data: jsonData,
      },
      { status: response.status } // Return the actual API status code
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Proxy error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
