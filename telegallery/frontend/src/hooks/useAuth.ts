"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAuth() {
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: api.auth.me,
    retry: false,
  });

  return {
    user: query.data?.user,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data?.user,
  };
}
