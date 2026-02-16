import { useQuery, useMutation, useQueryClient, QueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function performLogout(queryClient: QueryClient): Promise<void> {
  try {
    // Clear all cached data BEFORE calling logout
    queryClient.clear();
    queryClient.setQueryData(["/api/auth/user"], null);
    
    const response = await fetch("/api/logout", { 
      credentials: "include",
      cache: "no-store",
    });
    const data = await response.json();
    
    // Force a full page reload to clear any in-memory state
    // Use replace to prevent back button from returning to logged-in state
    window.location.replace(data.redirect || "/auth");
  } catch {
    // Clear cache even on error
    queryClient.clear();
    queryClient.setQueryData(["/api/auth/user"], null);
    window.location.replace("/auth");
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: () => performLogout(queryClient),
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
