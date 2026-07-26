"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useFiles(params: Record<string, string | number | boolean | undefined>) {
  const queryClient = useQueryClient();
  const key = ["files", params];

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.files.list(params),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  }

  return { ...query, invalidate };
}
