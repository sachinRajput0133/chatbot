output "cloudfront_domain" { value = module.cloudfront.domain_name }
output "alb_dns"           { value = module.alb.dns_name }
output "api_ecr_url"       { value = module.ecr.api_repository_url }
output "web_ecr_url"       { value = module.ecr.web_repository_url }
output "worker_ecr_url"    { value = module.ecr.worker_repository_url }
output "rds_endpoint"      { value = module.rds.cluster_endpoint; sensitive = true }
output "redis_endpoint"    { value = module.elasticache.primary_endpoint; sensitive = true }
output "uploads_bucket"    { value = module.s3.uploads_bucket_name }
output "assets_bucket"     { value = module.s3.assets_bucket_name }
output "ecs_cluster_name"  { value = module.ecs.cluster_name }
output "api_service_name"  { value = module.ecs.api_service_name }
