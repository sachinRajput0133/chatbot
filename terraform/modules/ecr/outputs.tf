output "api_repository_url"    { value = aws_ecr_repository.repos["api"].repository_url }
output "web_repository_url"    { value = aws_ecr_repository.repos["web"].repository_url }
output "worker_repository_url" { value = aws_ecr_repository.repos["worker"].repository_url }
