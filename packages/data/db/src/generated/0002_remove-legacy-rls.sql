DO $$
DECLARE
	policy_record record;
BEGIN
	FOR policy_record IN
		SELECT schemaname, tablename, policyname
		FROM pg_catalog.pg_policies
		WHERE schemaname = 'public'
	LOOP
		EXECUTE format(
			'DROP POLICY %I ON %I.%I',
			policy_record.policyname,
			policy_record.schemaname,
			policy_record.tablename
		);
	END LOOP;
END
$$;
--> statement-breakpoint
ALTER TABLE "public"."keys" ALTER COLUMN "created_by" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "public"."workspaces" ALTER COLUMN "owner_user_id" DROP DEFAULT;
