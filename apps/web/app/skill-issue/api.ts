"use client";

import { useMutation } from "@tanstack/react-query";
import { qk } from "@eve/api-client/queryKeys";
import type {
  SkillIssueAnalyzeRequest,
  SkillIssueAnalyzeResponse,
} from "@eve/api-contracts";
import { useApiClient } from "@/app/api-hooks/useApiClient";

export function useSkillIssueAnalyze() {
  const client = useApiClient();
  return useMutation({
    mutationKey: qk.skillIssue._root,
    mutationFn: async (input: SkillIssueAnalyzeRequest) => {
      return await client.post<SkillIssueAnalyzeResponse>(
        "/skill-issue/analyze",
        input,
      );
    },
  });
}
