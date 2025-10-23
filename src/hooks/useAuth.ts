import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useCurrentUser() {
	const user = useQuery(api.users.getCurrent);
	return {
		user: user ?? null,
		isLoading: user === undefined,
	} as const;
}

export function useRequireAuth(options?: { redirectTo?: string; whenUnauthed?: () => void }) {
	const router = useRouter();
	const { user, isLoading } = useCurrentUser();
		const redirectTarget = options?.redirectTo ?? "/login";
		const whenUnauthed = options?.whenUnauthed;

	useEffect(() => {
		if (isLoading) {
			return;
		}

		if (!user) {
			whenUnauthed?.();
			router.replace(redirectTarget);
		}
		}, [isLoading, user, router, redirectTarget, whenUnauthed]);

	return { user, isLoading } as const;
}
