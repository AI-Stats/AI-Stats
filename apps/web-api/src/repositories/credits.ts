import { creditGrantRedemptions, creditGrants, creditLedger, gatewayRequests, wallets, workspaceMembers, workspaceSettings, workspaces } from "@phaseo/db/schema";
import { and, desc, eq, or, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listCreditGrants(env: Env) { const {db,client}=createDatabase(env); try { return await db.select().from(creditGrants).orderBy(desc(creditGrants.createdAt)).limit(250); } finally {await client.end({timeout:1});} }
export async function listCreditWorkspaces(env:Env,userId:string){const{db,client}=createDatabase(env);try{return await db.selectDistinct({id:workspaces.id,name:workspaces.name,billingMode:workspaces.billingMode}).from(workspaces).leftJoin(workspaceMembers,and(eq(workspaceMembers.workspaceId,workspaces.id),eq(workspaceMembers.userId,userId))).where(or(eq(workspaces.ownerUserId,userId),eq(workspaceMembers.userId,userId)));}finally{await client.end({timeout:1});}}

export async function createCreditGrant(env: Env, values: typeof creditGrants.$inferInsert) {
	const {db,client}=createDatabase(env); try {
		return await db.transaction(async(tx)=>{
			const [existing]=await tx.select().from(creditGrants).where(eq(creditGrants.codeNormalized,values.codeNormalized)).limit(1);
			if (!existing) { await tx.insert(creditGrants).values(values); return "created" as const; }
			if (existing.isActive) return "active" as const;
			const [history]=await tx.select({count:sql<number>`count(*)::int`}).from(creditGrantRedemptions).where(eq(creditGrantRedemptions.grantId,existing.id));
			if ((history?.count??0)>0) return "history" as const;
			await tx.update(creditGrants).set({...values,redemptionsCount:0,disabledAt:null}).where(eq(creditGrants.id,existing.id)); return "reactivated" as const;
		});
	} finally {await client.end({timeout:1});}
}

export async function updateCreditGrant(env:Env,id:string,values:Partial<typeof creditGrants.$inferInsert>){const{db,client}=createDatabase(env);try{await db.update(creditGrants).set(values).where(eq(creditGrants.id,id));}finally{await client.end({timeout:1});}}
export async function deleteCreditGrant(env:Env,id:string){const{db,client}=createDatabase(env);try{return await db.transaction(async tx=>{const [history]=await tx.select({count:sql<number>`count(*)::int`}).from(creditGrantRedemptions).where(eq(creditGrantRedemptions.grantId,id));if((history?.count??0)>0)return false;await tx.delete(creditGrants).where(eq(creditGrants.id,id));return true;});}finally{await client.end({timeout:1});}}

export async function getWalletBalance(env:Env,workspaceId:string){const{db,client}=createDatabase(env);try{const [wallet]=await db.select({balance:wallets.balanceNanos}).from(wallets).where(eq(wallets.workspaceId,workspaceId)).limit(1);if(wallet)return wallet.balance;const [ledger]=await db.select({balance:creditLedger.afterBalanceNanos}).from(creditLedger).where(eq(creditLedger.workspaceId,workspaceId)).orderBy(desc(creditLedger.eventTime)).limit(1);return ledger?.balance??null;}finally{await client.end({timeout:1});}}

export async function getCreditTierSummary(env:Env,workspaceId:string){const{db,client}=createDatabase(env);try{const [row]=await db.execute<Record<string,unknown>>(sql`
		select workspace.tier,
		coalesce(sum(request.cost_nanos) filter(where request.success=true and request.created_at>=date_trunc('month',now())-interval '1 month' and request.created_at<date_trunc('month',now())),0)::bigint previous_nanos,
		coalesce(sum(request.cost_nanos) filter(where request.success=true and request.created_at>=date_trunc('month',now())),0)::bigint mtd_nanos
		from ${workspaces} workspace left join ${gatewayRequests} request on request.workspace_id=workspace.id where workspace.id=${workspaceId}::uuid group by workspace.tier
	`);return row??{tier:"basic",previous_nanos:0,mtd_nanos:0};}finally{await client.end({timeout:1});}}

export async function updateWalletTopUp(env:Env,workspaceId:string,values:{autoTopUpEnabled:boolean;lowBalanceThreshold:number;autoTopUpAmount:number;autoTopUpAccountId:string|null}){const{db,client}=createDatabase(env);try{return await db.update(wallets).set({...values,updatedAt:new Date().toISOString()}).where(eq(wallets.workspaceId,workspaceId)).returning();}finally{await client.end({timeout:1});}}
export async function saveWorkspaceNotifications(env:Env,workspaceId:string,values:Partial<typeof workspaceSettings.$inferInsert>){const{db,client}=createDatabase(env);try{await db.insert(workspaceSettings).values({workspaceId,...values}).onConflictDoUpdate({target:workspaceSettings.workspaceId,set:{...values,updatedAt:new Date().toISOString()}});}finally{await client.end({timeout:1});}}

export async function redeemCreditGrant(env:Env,input:{userId:string;workspaceId:string;code:string}){const{db,client}=createDatabase(env);try{return await db.transaction(async tx=>{
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.code}))`);
		const [grant]=await tx.select().from(creditGrants).where(eq(creditGrants.codeNormalized,input.code)).limit(1);
		if(!grant)return{status:"not_found",message:"This credit code is invalid."};
		if(!grant.isActive)return{status:"inactive",message:"This credit code is inactive.",grant_id:grant.id};
		if(grant.expiresAt&&Date.parse(grant.expiresAt)<=Date.now())return{status:"expired",message:"This credit code has expired.",grant_id:grant.id};
		if(grant.redemptionsCount>=grant.maxRedemptions)return{status:"maxed_out",message:"This credit code has reached its redemption limit.",grant_id:grant.id};
		const [workspace]=await tx.select({billingMode:workspaces.billingMode}).from(workspaces).where(eq(workspaces.id,input.workspaceId)).limit(1);
		if(workspace?.billingMode==="invoice")return{status:"invoice_mode",message:"Credit codes are not available for invoice billing teams."};
		// Redemptions for different codes can target the same wallet concurrently.
		// Lock the wallet row before reading its balance so every ledger entry and
		// balance update observes the result of the preceding transaction.
		await tx.execute(sql`select workspace_id from ${wallets} where workspace_id=${input.workspaceId}::uuid for update`);
		const [wallet]=await tx.select().from(wallets).where(eq(wallets.workspaceId,input.workspaceId)).limit(1);if(!wallet)return{status:"wallet_not_found",message:"Wallet not found for this team.",grant_id:grant.id};
		const [redemption]=await tx.insert(creditGrantRedemptions).values({grantId:grant.id,userId:input.userId,workspaceId:input.workspaceId,amountNanos:grant.amountNanos}).onConflictDoNothing({target:[creditGrantRedemptions.grantId,creditGrantRedemptions.userId]}).returning({id:creditGrantRedemptions.id});
		if(!redemption)return{status:"already_redeemed",message:"You have already redeemed this credit code.",grant_id:grant.id};
		const after=wallet.balanceNanos+grant.amountNanos;await tx.update(wallets).set({balanceNanos:after,updatedAt:new Date().toISOString()}).where(eq(wallets.workspaceId,input.workspaceId));
		await tx.insert(creditLedger).values({workspaceId:input.workspaceId,kind:"promo_code",amountNanos:grant.amountNanos,beforeBalanceNanos:wallet.balanceNanos,afterBalanceNanos:after,refType:"promo_code_redeem",refId:redemption.id,status:"paid"}).onConflictDoNothing({target:[creditLedger.refType,creditLedger.refId]});
		await tx.update(creditGrants).set({redemptionsCount:grant.redemptionsCount+1}).where(eq(creditGrants.id,grant.id));return{status:"succeeded",message:"Promo credit applied successfully.",grant_id:grant.id,amount_nanos:grant.amountNanos,before_balance_nanos:wallet.balanceNanos,after_balance_nanos:after,team_id:input.workspaceId};
	});}finally{await client.end({timeout:1});}}
