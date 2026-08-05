-- Debug query to check model_id format in the V2 request projection.
select distinct model_id, count(*) as cnt
from public.v2_web_gateway_requests
where created_at >= now() - interval '24 hours'
group by model_id
order by cnt desc
limit 20;
