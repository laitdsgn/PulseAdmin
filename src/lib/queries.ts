import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type Query } from "./api";
import type { City, Page } from "./types";

// Query keys are [path, query], so invalidating by path refreshes every filtered variant.
export const PAGE_SIZE = 50;

export const useInfiniteList = <T>(path: string, query: Query = {}, enabled = true) => {
  const result = useInfiniteQuery({
    queryKey: [path, query],
    queryFn: ({ pageParam, signal }) =>
      apiFetch<Page<T>>(path, { query: { ...query, cursor: pageParam, limit: PAGE_SIZE }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
  const items = result.data?.pages.flatMap((p) => p.data) ?? [];
  return { ...result, items };
};

export const useCities = () =>
  useQuery({
    queryKey: ["/v1/cities"],
    queryFn: () => apiFetch<{ data: City[] }>("/v1/cities", { auth: false }).then((r) => r.data),
    staleTime: Infinity,
  });

export const useInvalidate = () => {
  const queryClient = useQueryClient();
  return (...paths: string[]) => Promise.all(paths.map((path) => queryClient.invalidateQueries({ queryKey: [path] })));
};
