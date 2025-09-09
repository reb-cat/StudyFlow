import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // PHANTOM DEBUG: Log every API request to track phantom assignment sources
  console.log('🌐 FRONTEND API REQUEST:', {
    method,
    url,
    hasData: !!data,
    timestamp: new Date().toISOString()
  });

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Log response status to track successful vs failed calls
  console.log('📡 FRONTEND API RESPONSE:', {
    method,
    url,
    status: res.status,
    ok: res.ok,
    timestamp: new Date().toISOString()
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    
    // PHANTOM DEBUG: Log every query fetch to track phantom assignment sources
    console.log('🔍 QUERY FETCH:', {
      queryKey,
      url,
      timestamp: new Date().toISOString()
    });

    const res = await fetch(url, {
      credentials: "include",
    });

    // Log query response to track successful vs failed calls
    console.log('📊 QUERY RESPONSE:', {
      queryKey,
      url,
      status: res.status,
      ok: res.ok,
      timestamp: new Date().toISOString()
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    
    // PHANTOM DEBUG: Log response data if it contains assignments
    if (Array.isArray(data) && data.length > 0 && data[0]?.title) {
      console.log('📚 QUERY DATA (assignments):', {
        url,
        count: data.length,
        firstFew: data.slice(0, 3).map(a => ({ title: a.title, id: a.id }))
      });
    }
    
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }), // Don't throw on 401, just return null
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
